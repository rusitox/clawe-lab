#!/usr/bin/env bash
set -euo pipefail
TOKEN_FILE="/home/ubuntu/.openclaw/workspace/.secrets/kanban_token"
KANBAN_TOKEN=""
if [ -f "$TOKEN_FILE" ]; then
  KANBAN_TOKEN="$(cat "$TOKEN_FILE")"
fi
if [ -z "${KANBAN_TOKEN}" ]; then
  echo "Missing KANBAN token file: $TOKEN_FILE" >&2
  exit 1
fi

AGENT="${1:-Clawe}"
TYPE="${2:-info}"
shift 2 || true
TEXT="${*:-}" 

curl -sS -X POST "http://127.0.0.1:8787/api/activity" \
  -H "Content-Type: application/json" \
  -H "X-Kanban-Token: ${KANBAN_TOKEN}" \
  -d "$(python3 - <<PY
import json, time, os, sys
agent=os.environ.get('AGENT','')
type_=os.environ.get('TYPE','info')
text=os.environ.get('TEXT','')
print(json.dumps({'ts': int(time.time()*1000), 'agent': agent, 'type': type_, 'text': text}, ensure_ascii=False))
PY
)" >/dev/null
