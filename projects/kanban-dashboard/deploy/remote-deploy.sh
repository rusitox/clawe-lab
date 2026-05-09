#!/usr/bin/env bash
# Remote deploy on the VPS — invoked by .github/workflows/deploy.yml.
#
# This script is RERUNNABLE: the .env file is rendered fresh on every deploy
# from a versioned template (env.production) + secrets passed as env vars.
# Nothing important lives outside the repo + GitHub Secrets.
#
# Workflow:
#   1. Render .env (template + injected secrets + APP_IMAGE).
#   2. Record previous APP_IMAGE for rollback.
#   3. `docker compose pull` + `up -d`.
#   4. Poll /api/health for 60s.
#   5. On failure: restore previous APP_IMAGE and bring stack back up.
#
# Required env vars (passed via ssh from .github/workflows/deploy.yml):
#   APP_IMAGE             — full image ref, e.g. ghcr.io/owner/repo:abc1234
#   POSTGRES_PASSWORD     — DB password (rotable; required)
#   SESSION_SECRET        — 64-hex random string (required)
#   GOOGLE_CLIENT_ID      — GCP OAuth client ID (required)
#   GOOGLE_CLIENT_SECRET  — GCP OAuth client secret (required)
#
# Optional:
#   COMPOSE_DIR           — default /home/ubuntu/openclaw-kanban-v2
#   COMPOSE_FILE          — default docker-compose.prod.yml
#   ENV_TEMPLATE          — default $COMPOSE_DIR/deploy/env.production
#   HEALTH_URL            — default http://127.0.0.1:8788/api/health
#   GHCR_USER / GHCR_TOKEN — for private GHCR images
set -euo pipefail

APP_IMAGE="${APP_IMAGE:?APP_IMAGE env var is required}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD env var is required}"
SESSION_SECRET="${SESSION_SECRET:?SESSION_SECRET env var is required}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:?GOOGLE_CLIENT_ID env var is required}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:?GOOGLE_CLIENT_SECRET env var is required}"

COMPOSE_DIR="${COMPOSE_DIR:-/home/ubuntu/openclaw-kanban-v2}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_TEMPLATE="${ENV_TEMPLATE:-$COMPOSE_DIR/deploy/env.production}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8788/api/health}"

log() { printf "▶ %s\n" "$*"; }
fail() { printf "✗ %s\n" "$*" >&2; exit 1; }

[ -d "$COMPOSE_DIR" ] || fail "$COMPOSE_DIR does not exist (run docs/ops.md §1 first)"
cd "$COMPOSE_DIR"
[ -f "$COMPOSE_FILE" ] || fail "$COMPOSE_FILE not found in $COMPOSE_DIR"
[ -f "$ENV_TEMPLATE" ] || fail "env template not found at $ENV_TEMPLATE"

# Optional: login to GHCR for private images.
if [ -n "${GHCR_USER:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  log "logging into ghcr.io as $GHCR_USER"
  echo "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin >/dev/null
fi

# 1. Capture previous APP_IMAGE for rollback (empty on first deploy).
PREV_IMAGE=""
if [ -f .env ]; then
  PREV_IMAGE=$(grep '^APP_IMAGE=' .env | head -1 | cut -d= -f2- || true)
fi
log "previous APP_IMAGE: ${PREV_IMAGE:-<none>}"
log "deploying:          $APP_IMAGE"

# 2. Render .env atomically: template + secrets + APP_IMAGE.
render_env() {
  local image="$1" tmp
  tmp="$(mktemp .env.XXXXXX)"
  # Strip any APP_IMAGE / secret lines from template (defensive — they shouldn't be there).
  grep -vE '^(APP_IMAGE|POSTGRES_PASSWORD|SESSION_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET)=' \
    "$ENV_TEMPLATE" > "$tmp"
  {
    echo ""
    echo "# --- Injected by remote-deploy.sh ($(date -u +%FT%TZ)) ---"
    echo "APP_IMAGE=${image}"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "SESSION_SECRET=${SESSION_SECRET}"
    echo "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
    echo "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
  } >> "$tmp"
  chmod 0600 "$tmp"
  mv "$tmp" .env
}

log "rendering .env from $ENV_TEMPLATE + secrets"
render_env "$APP_IMAGE"

# 3. Pull + recreate (db is unchanged, only app gets new image).
log "pulling new image"
docker compose -f "$COMPOSE_FILE" pull app
log "applying compose up -d"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# 4. Smoke test: poll /api/health up to 60s.
log "smoke-testing $HEALTH_URL"
SMOKE_OK=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null | grep -q '"db":"up"'; then
    SMOKE_OK=1
    log "  health OK after ${i}s"
    break
  fi
  sleep 2
done

if [ "$SMOKE_OK" -ne 1 ]; then
  log "smoke FAILED — rolling back to ${PREV_IMAGE:-<none>}"
  if [ -n "$PREV_IMAGE" ]; then
    render_env "$PREV_IMAGE"
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans || true
    log "rolled back; check logs: docker compose -f $COMPOSE_FILE logs --tail=200 app"
  else
    log "no previous image known; leaving stack as-is for inspection"
  fi
  fail "deploy aborted (health check did not pass within 60s)"
fi

# 5. Prune dangling images so /var doesn't fill up.
log "pruning dangling images"
docker image prune -f >/dev/null 2>&1 || true

log "deploy succeeded — $APP_IMAGE"
