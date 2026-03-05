#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8790}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/dist"
LOG="/home/ubuntu/.openclaw/workspace/tmp/familyhub_web_preview_${PORT}.log"

if [ ! -d "$DIR" ]; then
  echo "dist/ not found. Run: npx expo export --platform web" >&2
  exit 1
fi

# Kill previous listeners on the port (best effort)
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti tcp:"$PORT" || true)
  if [ -n "${PIDS:-}" ]; then
    kill ${PIDS} || true
  fi
else
  # fallback: try fuser if available
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" || true
  fi
fi

nohup python3 -m http.server "$PORT" --directory "$DIR" > "$LOG" 2>&1 &
PID=$!

echo "Started web preview on :$PORT (pid $PID)"
echo "Log: $LOG"
