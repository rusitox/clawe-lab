#!/usr/bin/env bash
set -euo pipefail

# Approve a PR using clawe-bot credentials.
# Usage: approve_pr.sh <pr_number> [owner] [repo]

PR="${1:-}"
OWNER="${2:-rusitox}"
REPO="${3:-clawe-lab}"

if [ -z "$PR" ]; then
  echo "Usage: $0 <pr_number> [owner] [repo]" >&2
  exit 2
fi

TOKEN_FILE="/home/ubuntu/.openclaw/workspace/.secrets/github_pat_clawe_bot"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "Missing token file: $TOKEN_FILE" >&2
  exit 1
fi

PAT="$(cat "$TOKEN_FILE")"
API="https://api.github.com"

payload='{"event":"APPROVE","body":"Approved by clawe-bot"}'

http=$(curl -sS -o /tmp/clawe_bot_approve.json -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $PAT" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H 'Accept: application/vnd.github+json' \
  -H 'Content-Type: application/json' \
  "$API/repos/$OWNER/$REPO/pulls/$PR/reviews" \
  -d "$payload")

if [ "$http" != "200" ] && [ "$http" != "201" ]; then
  echo "approve_http=$http" >&2
  cat /tmp/clawe_bot_approve.json >&2
  exit 1
fi

echo "approved pr#$PR ($OWNER/$REPO)"
