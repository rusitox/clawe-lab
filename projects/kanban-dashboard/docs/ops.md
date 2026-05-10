# Ops runbook — Clawe Kanban v2

Step-by-step operational commands for the **Docker-based** stack on the
Oracle Cloud VPS. For architecture context, decisions, and the lessons
learned during setup, see [`docs/ci-cd.md`](./ci-cd.md).

**Stack:** nginx (host) → Docker compose (`app` + `db`) on the same VPS that
also runs familyhub via Tailscale Funnel.

**Production URL:** https://136-248-107-132.nip.io
**SSH:** `ssh ubuntu@136.248.107.132`
**Compose dir:** `/home/ubuntu/openclaw-kanban-v2/`

---

## 1. First-time install (fresh VPS)

The deploy workflow expects a minimal bootstrap on the VPS — Docker + nginx
+ a directory. Everything else (`.env`, `docker-compose.prod.yml`,
`remote-deploy.sh`) is uploaded by GitHub Actions on each deploy.

```bash
# As ubuntu on the VPS
sudo apt update
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo usermod -aG docker ubuntu   # log out / log back in for group to apply

# Project dir (compose lives here, GHA uploads the file each deploy)
mkdir -p /home/ubuntu/openclaw-kanban-v2/deploy

# nginx site
sudo $EDITOR /etc/nginx/sites-available/kanban.conf
# Paste the server block below (see §4), enable:
sudo ln -sf /etc/nginx/sites-available/kanban.conf /etc/nginx/sites-enabled/kanban.conf

# Verify nginx.conf includes sites-enabled — if NOT, append the include:
sudo grep -q "include /etc/nginx/sites-enabled/" /etc/nginx/nginx.conf || \
  sudo sed -i '$i\  include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf

sudo nginx -t && sudo systemctl reload nginx

# UFW (host firewall)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

**Oracle VCN:** also open ingress for ports 80 and 443 (TCP, source
`0.0.0.0/0`) in the cloud console — UFW alone isn't enough on Oracle Cloud.

**SSH key for GitHub Actions deploys:** generate locally, push pubkey to VPS:

```bash
# On your laptop
ssh-keygen -t ed25519 -C "github-actions-deploy@clawe-kanban" \
  -f ~/.ssh/openclaw_deploy -N ""

# Register pubkey on the VPS
echo "$(cat ~/.ssh/openclaw_deploy.pub)" | \
  ssh ubuntu@136.248.107.132 "cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

# Set GitHub Secrets (see deploy/SECRETS.md for the full list)
cat ~/.ssh/openclaw_deploy            | gh secret set DEPLOY_SSH_KEY      --repo rusitox/clawe-lab
ssh-keyscan -t ed25519 136.248.107.132 | gh secret set DEPLOY_KNOWN_HOSTS --repo rusitox/clawe-lab
printf %s "ubuntu"                     | gh secret set DEPLOY_USER        --repo rusitox/clawe-lab
printf %s "136.248.107.132"            | gh secret set DEPLOY_HOST        --repo rusitox/clawe-lab
printf %s "https://136-248-107-132.nip.io" | gh secret set DEPLOY_PUBLIC_URL --repo rusitox/clawe-lab
```

**Application secrets** (one-time generation, paste into GH Secrets):

```bash
openssl rand -hex 24 | gh secret set POSTGRES_PASSWORD --repo rusitox/clawe-lab
openssl rand -hex 32 | gh secret set SESSION_SECRET   --repo rusitox/clawe-lab

# Google OAuth — created in GCP Console (Project: KanbanClawe), Web application,
# redirect URI = https://136-248-107-132.nip.io/auth/google/callback
gh secret set GOOGLE_CLIENT_ID     --repo rusitox/clawe-lab    # paste from GCP
gh secret set GOOGLE_CLIENT_SECRET --repo rusitox/clawe-lab    # paste from GCP
```

Once secrets are set, run `gh workflow run "Kanban Deploy (Oracle VPS)"` (or
push to main) to do the first deploy. The remote-deploy script renders
`.env`, pulls the image, and brings the stack up.

---

## 2. Deploy (every release)

**Default path: GitHub Actions.** Push to `main` (or merge a PR) → `Kanban CI`
runs (lint + types + tests + Docker build) → on green, `Kanban Deploy` fires
automatically and ships the new image to the VPS.

For manual deploy of a specific ref:

```bash
gh workflow run "Kanban Deploy (Oracle VPS)" --repo rusitox/clawe-lab \
  -f ref=feat/some-branch
```

The deploy script (`deploy/remote-deploy.sh`) does:

1. Capture the previous `APP_IMAGE` from the existing `.env` (rollback target).
2. Render `.env` from `deploy/env.production` + injected secrets + new `APP_IMAGE`.
3. `docker compose pull app && docker compose up -d --remove-orphans` — the
   container's `entrypoint.sh` runs `alembic upgrade head` automatically.
4. Poll `http://127.0.0.1:8788/api/health` for up to 60 s (asserting `db:"up"`).
5. **On failure:** re-render `.env` with the previous `APP_IMAGE`, bring back
   up, exit 1. Stack stays serving the old image.

A second probe runs from inside GitHub Actions against the public URL after
the remote install reports success.

### Quick health check after deploy

```bash
curl -fsS https://136-248-107-132.nip.io/api/health
# {"ok":true,"version":"2.0.0","db":"up"}
```

### Watch logs from the VPS

```bash
ssh ubuntu@136.248.107.132
cd /home/ubuntu/openclaw-kanban-v2
docker compose -f docker-compose.prod.yml logs -f --tail=100 app
```

---

## 3. Manual rollback

If a deploy slipped through both health checks (rare — the script auto-rollbacks)
or you need to roll back to a much older release:

```bash
ssh ubuntu@136.248.107.132
cd /home/ubuntu/openclaw-kanban-v2

# List recent images locally
docker images ghcr.io/rusitox/openclaw-kanban-v2 --format "{{.Tag}} {{.CreatedAt}}"

# Or fetch a specific older tag from GHCR
docker pull ghcr.io/rusitox/openclaw-kanban-v2:<short-sha>

# Edit .env to point at the old tag
sed -i 's|^APP_IMAGE=.*|APP_IMAGE=ghcr.io/rusitox/openclaw-kanban-v2:<short-sha>|' .env

docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs --tail=200 app
```

> The `.env` is reset on the next successful deploy from the workflow, so this
> manual edit only survives until the next push.

If the failed release ran a destructive Alembic migration, restore the DB
**before** restarting the older image. See §6 for backup procedures.

---

## 4. nginx + TLS

The kanban server block lives in `/etc/nginx/sites-available/kanban.conf`:

```nginx
server {
    server_name 136-248-107-132.nip.io;
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:8788;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 10.0.0.49:443 ssl;   # bind to eth0 specifically — see ci-cd.md §6.4
    ssl_certificate /etc/letsencrypt/live/136-248-107-132.nip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/136-248-107-132.nip.io/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = 136-248-107-132.nip.io) { return 301 https://$host$request_uri; }
    listen 80;
    listen [::]:80;
    server_name 136-248-107-132.nip.io;
    return 404;
}
```

Issue + renew certificate:

```bash
sudo certbot --nginx -d 136-248-107-132.nip.io \
  --non-interactive --agree-tos -m mariano.ortega@gmail.com
sudo nginx -t && sudo systemctl reload nginx
```

Auto-renewal runs via `certbot.timer` (system unit). Verify:

```bash
systemctl list-timers | grep certbot
```

---

## 5. Google OAuth setup

Done once during initial deploy. Re-do only if rotating credentials or
moving to a new redirect URL (e.g., a real domain).

1. Sign in to the **Clawe gmail** account at <https://console.cloud.google.com/>.
2. Project: **KanbanClawe** (already created — switch to it via the project dropdown).
3. **APIs & Services → OAuth consent screen** → External, app name `Clawe Kanban`.
4. **APIs & Services → Credentials** → Create OAuth client ID → **Web application**.
5. **Authorized redirect URI:** `https://136-248-107-132.nip.io/auth/google/callback`
   — must match `OAUTH_REDIRECT_URI` in `deploy/env.production` byte-for-byte.
6. Copy the **Client ID** and **Client Secret** to GH Secrets:
   ```bash
   echo "<client-id>"     | gh secret set GOOGLE_CLIENT_ID     --repo rusitox/clawe-lab
   pbpaste                | gh secret set GOOGLE_CLIENT_SECRET --repo rusitox/clawe-lab
   ```
7. Trigger a redeploy (the next push to main, or manual workflow_dispatch).

To rotate just the secret without changing the Client ID: GCP Credentials →
click the OAuth client → **RESET SECRET** → copy new value → update GH Secret →
redeploy.

---

## 6. Backups

> ⚠️ **Backups are not yet automated.** Set up cron or a systemd timer.

Manual backup (run on VPS):

```bash
cd /home/ubuntu/openclaw-kanban-v2

# Postgres dump (custom format — supports parallel restore + selective objects)
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump --format=custom -U openclaw openclaw_kanban \
  > /var/backups/openclaw-kanban-$(date +%F).pgdump

# Attachments (named volume)
docker run --rm -v openclaw-kanban-v2_attachments:/src \
  -v /var/backups:/dst alpine \
  tar -czf /dst/openclaw-kanban-attachments-$(date +%F).tar.gz -C /src .
```

Keep ≥14 days off-host (Oracle Object Storage or rclone to S3-compatible).

Restore:

```bash
cd /home/ubuntu/openclaw-kanban-v2

# Stop the app (DB stays up)
docker compose -f docker-compose.prod.yml stop app

# Drop + recreate the DB inside the running db container
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U openclaw -d postgres -c 'DROP DATABASE openclaw_kanban; CREATE DATABASE openclaw_kanban OWNER openclaw;'

# Restore from dump
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore --dbname=openclaw_kanban -U openclaw \
  < /var/backups/openclaw-kanban-YYYY-MM-DD.pgdump

# Restore attachments
docker run --rm -v openclaw-kanban-v2_attachments:/dst \
  -v /var/backups:/src alpine \
  sh -c 'cd /dst && tar -xzf /src/openclaw-kanban-attachments-YYYY-MM-DD.tar.gz'

docker compose -f docker-compose.prod.yml start app
```

---

## 7. Migrating v1 data (one-time)

`scripts/import_v1.py` is the migration utility. It reads v1 JSON files
(tasks, activity, teams) and idempotently writes to the v2 Postgres schema.

The owner email must already exist as a user (i.e., that person has signed in
via Google at least once on the v2 instance).

```bash
ssh ubuntu@136.248.107.132
cd /home/ubuntu/openclaw-kanban-v2

# Copy v1 JSONs to a known location (or scp from your laptop)
mkdir -p /tmp/v1
# scp tasks.json activity.json teams.json ubuntu@vps:/tmp/v1/

docker compose -f docker-compose.prod.yml exec -T app python scripts/import_v1.py \
  --owner-email mariano.ortega@gmail.com \
  --project-name "Clawe HQ" \
  --tasks-json /tmp/v1/tasks.json \
  --activity-json /tmp/v1/activity.json \
  --teams-json /tmp/v1/teams.json
```

Re-runs are idempotent — see `specs/sdd-kanban-v2.md §5`.

---

## 8. Sunsetting the legacy v1 API

`/api/{tasks,activity,teams}` stays online behind `LEGACY_KANBAN_TOKEN`
until OpenClaw is migrated to `/api/v2/*`. Currently empty (= disabled,
returns 503). To re-enable temporarily:

1. Set `LEGACY_KANBAN_TOKEN` in `deploy/env.production` (PR + merge).
2. Redeploy.

To force the cutover (already the default state):

```bash
# In deploy/env.production:
LEGACY_KANBAN_TOKEN=
# Commit + merge → redeploy. v1 endpoints return 503 service_unavailable.
```

The Sunset header date is hardcoded to `2026-09-30` in `server/api/v1_legacy.py`;
bump it via PR if the deprecation window slips.

---

## 9. Rotating secrets

| Secret | Rotation procedure |
|---|---|
| `SESSION_SECRET` | Plan downtime — all sessions invalidated. `openssl rand -hex 32 \| gh secret set SESSION_SECRET --repo rusitox/clawe-lab` → redeploy. |
| `GOOGLE_CLIENT_SECRET` | GCP Credentials → click OAuth client → RESET SECRET → copy new value → `pbpaste \| gh secret set GOOGLE_CLIENT_SECRET --repo rusitox/clawe-lab` → redeploy. Old secret keeps working briefly. |
| `POSTGRES_PASSWORD` | New password: `openssl rand -hex 24`. `ALTER USER openclaw WITH PASSWORD 'new'` inside the `db` container, then update GH Secret, then redeploy. Plan ~30s of downtime. |
| `LEGACY_KANBAN_TOKEN` | Coordinate with OpenClaw operator — they have to update their config in lockstep. |
| API tokens (per-user) | Revoke at `/settings/tokens`. The token list shows last-used + prefix to help identify a leaked one. |
| `DEPLOY_SSH_KEY` | Generate new keypair, push pubkey to `~ubuntu/.ssh/authorized_keys`, set new `DEPLOY_SSH_KEY` secret. Remove old pubkey from `authorized_keys` once a deploy succeeds with the new key. |

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` from public URL | `app` container down | `docker compose logs app --tail=100`, then `docker compose up -d` |
| `502 Bad Gateway` even though `app` is up | nginx routes to wrong port | Confirm `kanban.conf` `proxy_pass http://127.0.0.1:8788` matches `HOST_PORT` in `.env` |
| `/api/health` returns `{"db":"down"}` | `db` container unreachable | `docker compose ps`, restart `db` |
| OAuth callback returns 500 | Redirect URI mismatch | Compare `OAUTH_REDIRECT_URI` env vs GCP credentials byte-by-byte |
| Login bounces back to `/login?error=invalid_state` | OAuth state expired (>10 min) or DB write blocked | Check `docker compose logs app` for `oauth_state`, retry sign-in |
| `403 unauthorized` on `POST /api/v2/tokens` from a bearer | By design — bearers cannot mint tokens. Use a browser session. | n/a |
| Visual regression test fails in CI | OS/font drift Linux ≠ macOS | See `docs/ci-cd.md §6.9`. Re-capture Linux snapshots and commit. |
| Attachment upload returns 413 | nginx `client_max_body_size` < `ATTACHMENTS_MAX_BYTES` | Bump nginx `client_max_body_size` AND env var, both. |
| `nginx: bind() to 0.0.0.0:443 failed (98)` | tailscaled holds tailnet IP on 443 | nginx `listen` must use specific eth0 IP, not catch-all. See `ci-cd.md §6.4`. |
| Deploy workflow shows "failed" but no jobs ran | False positive on workflow file push | Ignore. See `ci-cd.md §7.4`. |
| Pre-existing `.env` on VPS doesn't reflect new env var | `.env` is regenerated each deploy from `env.production` | Update `deploy/env.production` in the repo and redeploy. |

For deeper architecture/context (why these issues exist, decisions taken),
read [`docs/ci-cd.md`](./ci-cd.md).
