# Deploy secrets — one-time GitHub setup

The `Deploy (Oracle VPS)` workflow renders the `.env` on the VPS from a
versioned template (`deploy/env.production`) plus secrets injected from
GitHub Actions. Two groups of secrets:

- **SSH access** — how the workflow reaches the VPS (4 secrets).
- **Application secrets** — values written into `.env` on every deploy (4 secrets).

Settings → Secrets and variables → Actions → **New repository secret** (or
attach them to a `production` environment if you want a manual approval gate
before each deploy).

## 1. SSH access secrets

| Secret | Example | What for |
|---|---|---|
| `DEPLOY_HOST` | `136.248.107.132` | Where to SSH |
| `DEPLOY_USER` | `ubuntu` | The Linux user on the VPS that runs the deploy |
| `DEPLOY_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----…` | Private key whose pubkey is in `~ubuntu/.ssh/authorized_keys` |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 136.248.107.132` | Trusts the host key |
| `DEPLOY_PUBLIC_URL` | `https://136-248-107-132.nip.io` | Optional. Workflow probes `${URL}/api/health` after the remote restart |

Generate the SSH key + known_hosts:

```bash
ssh-keygen -t ed25519 -C deploy@kanban -f ~/.ssh/openclaw_deploy -N ""
cat ~/.ssh/openclaw_deploy            # → DEPLOY_SSH_KEY
cat ~/.ssh/openclaw_deploy.pub        # → append to ubuntu@VPS:~/.ssh/authorized_keys
ssh-keyscan -t ed25519 136.248.107.132   # → DEPLOY_KNOWN_HOSTS
```

## 2. Application secrets

Written into `.env` on the VPS on every deploy. **Generate once, store, rotate
when needed.** Non-secret config (`HOST_PORT`, `OAUTH_REDIRECT_URI`, etc.)
lives in `deploy/env.production` — version controlled.

| Secret | How to generate | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` | Rotation requires DB restart + `ALTER USER` (planned downtime) |
| `SESSION_SECRET` | `openssl rand -hex 32` | Rotating logs out everyone — only during planned windows |
| `GOOGLE_CLIENT_ID` | GCP Console → APIs & Services → Credentials → OAuth client ID (Web application) | Application type: Web application. Public-ish but treat as secret |
| `GOOGLE_CLIENT_SECRET` | Same place as `GOOGLE_CLIENT_ID` | Rotation: regenerate in GCP, update secret, redeploy |

Authorized redirect URI in GCP **must match** `OAUTH_REDIRECT_URI` in
`deploy/env.production` byte-for-byte (currently
`https://136-248-107-132.nip.io/auth/google/callback`).

## 3. First-time bootstrap on the VPS

Once. The deploy user (`ubuntu` by default) needs:

1. Docker + Docker Compose installed.
2. nginx in front, terminating TLS.
3. The compose file dropped in `/home/ubuntu/openclaw-kanban-v2/`.

```bash
# As ubuntu on the VPS:
mkdir -p /home/ubuntu/openclaw-kanban-v2/deploy
cd /home/ubuntu/openclaw-kanban-v2

# Download the compose file from the repo (or git clone it).
curl -fsSLO https://raw.githubusercontent.com/<owner>/<repo>/main/projects/kanban-dashboard/docker-compose.prod.yml
```

The workflow uploads `deploy/env.production` and `deploy/remote-deploy.sh` on
each run, so those don't need to be there beforehand.

## 4. End-to-end deploy flow

```
push to main / manual workflow_dispatch
   │
   ▼
.github/workflows/ci.yml  (lint + typecheck + pytest + Playwright + Dockerfile build)
   │
   ▼  (only if CI green)
.github/workflows/deploy.yml
   │
   ├─ build & push image → ghcr.io/<owner>/openclaw-kanban-v2:<sha> (multi-arch)
   ├─ scp remote-deploy.sh + env.production → VPS:/tmp + .../deploy/
   └─ ssh: KEY=… bash /tmp/remote-deploy.sh
            │
            ├─ render .env: env.production + injected secrets + APP_IMAGE
            ├─ snapshot previous APP_IMAGE for rollback
            ├─ docker compose pull app
            ├─ docker compose up -d --remove-orphans   (entrypoint runs alembic)
            ├─ poll http://127.0.0.1:8788/api/health for up to 60s
            └─ on failure: re-render .env with previous APP_IMAGE, up -d, exit 1
   │
   └─ probe ${DEPLOY_PUBLIC_URL}/api/health publicly → assert db:"up"
```

## 5. Manual rollback

If a bad deploy slips through both health checks:

```bash
# As ubuntu on the VPS:
cd /home/ubuntu/openclaw-kanban-v2
sed -i 's|^APP_IMAGE=.*|APP_IMAGE=ghcr.io/<owner>/openclaw-kanban-v2:<previous-sha>|' .env
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs --tail=200 app
```

The `.env` is reset on the next successful deploy, so manual edits only
survive until the next workflow run.

DB migrations applied by the bad release are NOT auto-reverted — see
`docs/ops.md §3` for DB restore procedure if a destructive migration ran.

## 6. Optional: require a manual approval before each prod deploy

In Settings → Environments → `production`, enable **Required reviewers**. The
workflow pauses at the `deploy` job until someone clicks "Approve and deploy".
