# Ops runbook — Clawe Kanban v2

Target host: **Oracle Cloud VPS** (single node).
Stack: nginx → uvicorn (systemd) → Postgres 16.
Source of truth for design + decisions: `specs/sdd-kanban-v2.md`.

## 1. First-time install (Oracle VPS)

```bash
# As root
adduser --system --group --home /opt/openclaw-kanban-v2 openclaw

apt update
apt install -y python3.11 python3.11-venv python3.11-dev libpq-dev postgresql-16 nginx certbot python3-certbot-nginx

# Postgres
sudo -u postgres createuser openclaw
sudo -u postgres createdb -O openclaw openclaw_kanban
sudo -u postgres psql -c "ALTER USER openclaw WITH PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -d openclaw_kanban -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;'

# Runtime data dirs
mkdir -p /var/lib/openclaw-kanban/attachments
mkdir -p /var/log/openclaw-kanban
chown -R openclaw:openclaw /var/lib/openclaw-kanban /var/log/openclaw-kanban

# Env file (mode 0600)
cp deploy/env.example /etc/openclaw-kanban.env
chmod 0600 /etc/openclaw-kanban.env
chown root:openclaw /etc/openclaw-kanban.env
$EDITOR /etc/openclaw-kanban.env
```

## 2. Deploy (every release)

**Default path: GitHub Actions.** Push to `main` → CI (lint + types + pytest +
Playwright + build) → Deploy workflow SSHs to the VPS and runs the atomic
install. One-time setup in `deploy/SECRETS.md` (5 GitHub secrets + a `deploy`
Linux user with scoped sudo).

The deploy script (`deploy/remote-deploy.sh`) does:

1. Snapshot `/opt/openclaw-kanban-v2/` → `…-prev` (rollback target).
2. Stop the service, extract the new artifact, swap atomically.
3. `pip install -r requirements.lock.txt` (idempotent).
4. Start the service. The systemd unit's `ExecStartPre` runs
   `alembic upgrade head` so migrations match the running code.
5. Poll `http://127.0.0.1:8787/api/health` for up to 60 s.
6. **On failure**: restore the snapshot and restart — service stays up, deploy
   fails red.

A second probe runs from inside GitHub Actions against the public URL after
the remote install reports success.

### Manual deploy (no CI)

For shipping from a branch without going through Actions:

```bash
make build
TARBALL="openclaw-kanban-v2-$(git rev-parse --short HEAD).tar.gz"
tar -C dist -czf "$TARBALL" .

scp "$TARBALL" deploy/remote-deploy.sh deploy@kanban.example.com:/tmp/
ssh deploy@kanban.example.com \
  "sudo ARTIFACT=/tmp/$TARBALL bash /tmp/remote-deploy.sh"
```

Health check after either path:
```bash
curl -fsS https://kanban.example.com/api/health
# {"ok":true,"version":"2.0.0","db":"up"}
```

## 3. Rollback

```bash
# As root
systemctl stop openclaw-kanban-v2

# Restore previous artifact
rsync -a --delete /opt/openclaw-kanban-v2-prev/ /opt/openclaw-kanban-v2/

# If the failed release ran a destructive migration, restore DB from backup
# BEFORE the previous artifact's `alembic upgrade head` runs (which will
# downgrade if the lower revision exists). See §6 for backup procedures.

systemctl start openclaw-kanban-v2
```

## 4. nginx + TLS

```bash
cp deploy/nginx.conf.example /etc/nginx/sites-available/openclaw-kanban-v2.conf
ln -s /etc/nginx/sites-available/openclaw-kanban-v2.conf /etc/nginx/sites-enabled/
$EDITOR /etc/nginx/sites-available/openclaw-kanban-v2.conf  # set the real domain

certbot --nginx -d kanban.example.com  # automatic Let's Encrypt + renewal
nginx -t && systemctl reload nginx
```

Renewals run via the system `certbot.timer`; verify with `systemctl list-timers | grep certbot`.

## 5. Google OAuth setup

1. Create a project at <https://console.cloud.google.com/>.
2. **APIs & Services → OAuth consent screen** → External, fill app name + support email.
3. **APIs & Services → Credentials** → Create OAuth client ID → **Web application**.
4. Authorized JavaScript origins: `https://kanban.example.com`.
5. Authorized redirect URIs: `https://kanban.example.com/auth/google/callback` (must match `OAUTH_REDIRECT_URI`).
6. Copy `Client ID` and `Client secret` into `/etc/openclaw-kanban.env` (see §1).
7. Restart: `systemctl restart openclaw-kanban-v2`.

If you need to rotate the secret, repeat steps 3–6 and `systemctl restart`. There is no token revocation flow needed for sessions — they keep working until the cookie expires.

## 6. Backups

```bash
# Daily — schedule via cron or a systemd timer.
sudo -u postgres pg_dump --format=custom openclaw_kanban \
  > /var/backups/openclaw-kanban-$(date +%F).pgdump
tar -czf /var/backups/openclaw-kanban-attachments-$(date +%F).tar.gz \
  -C /var/lib/openclaw-kanban attachments
```

Keep ≥ 14 days off-host (Oracle Object Storage or rclone to S3-compatible).

Restore:
```bash
systemctl stop openclaw-kanban-v2
sudo -u postgres dropdb openclaw_kanban
sudo -u postgres createdb -O openclaw openclaw_kanban
sudo -u postgres pg_restore --dbname=openclaw_kanban \
  /var/backups/openclaw-kanban-YYYY-MM-DD.pgdump
tar -xzf /var/backups/openclaw-kanban-attachments-YYYY-MM-DD.tar.gz \
  -C /var/lib/openclaw-kanban
chown -R openclaw:openclaw /var/lib/openclaw-kanban
systemctl start openclaw-kanban-v2
```

## 7. Migrating v1 data (one-time)

```bash
sudo -u openclaw env $(cat /etc/openclaw-kanban.env | grep -v '^#' | xargs) \
  /opt/openclaw-kanban-v2/.venv/bin/python3 \
  /opt/openclaw-kanban-v2/scripts/import_v1.py \
  --owner-email YOU@gmail.com \
  --project-name "Clawe HQ" \
  --tasks-json /var/lib/openclaw-kanban/legacy/tasks.json \
  --activity-json /var/lib/openclaw-kanban/legacy/activity.json \
  --teams-json /var/lib/openclaw-kanban/legacy/teams.json
```

The owner must have signed in at least once via Google so the user row exists. Re-runs are idempotent — see §5 of the SDD.

## 8. Sunsetting the legacy v1 API

The `/api/{tasks,activity,teams}` surface stays online behind `LEGACY_KANBAN_TOKEN` until OpenClaw is migrated to `/api/v2/*`. To force the cutover:

```bash
# Edit /etc/openclaw-kanban.env
LEGACY_KANBAN_TOKEN=

systemctl restart openclaw-kanban-v2
# v1 endpoints now return 503 service_unavailable for any caller.
```

The Sunset date is hardcoded to `2026-09-30` in `server/api/v1_legacy.py`; bump it via PR if the deprecation window slips.

## 9. Rotating secrets

| Secret | Rotation |
|--------|----------|
| `SESSION_SECRET` | Plan a downtime window — all sessions invalidated. Generate via `openssl rand -hex 32`. |
| `GOOGLE_CLIENT_SECRET` | Create new in GCP, paste in env, restart. The old secret keeps working until you delete it in GCP. |
| `LEGACY_KANBAN_TOKEN` | Coordinate with OpenClaw operator — they have to update their own config in lockstep. |
| Postgres password | `ALTER USER openclaw WITH PASSWORD 'new'` then update `DATABASE_URL`. Restart. |
| API tokens (per-user) | Revoke at `/settings/tokens`. The token list shows last-used + prefix to help identify a leaked one. |

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `502 Bad Gateway` on the domain | uvicorn down | `journalctl -u openclaw-kanban-v2 -n 100` |
| `/api/health` returns `{"db":"down"}` | Postgres unreachable | `systemctl status postgresql`, check `DATABASE_URL` |
| OAuth callback returns 500 | Redirect URI mismatch | Compare `OAUTH_REDIRECT_URI` env vs GCP credentials |
| Login bounces back to `/login?error=invalid_state` | OAuth state expired (>10 min) or DB write blocked | Check journald for `oauth_state`, retry sign-in |
| `403 unauthorized` on `POST /api/v2/tokens` from a bearer | By design — bearers cannot mint tokens. Use a browser session. | n/a |
| Visual regression test fails in CI | OS/font drift from local | Regenerate baselines on CI (`make e2e-update`), commit only those |
| Attachment upload returns 413 | nginx `client_max_body_size` < `ATTACHMENTS_MAX_BYTES` | Bump nginx limit AND env var |
