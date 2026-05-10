#!/usr/bin/env bash
# Clawe Kanban v2 — daily backup script.
# Run via cron: 0 2 * * * /home/ubuntu/openclaw-kanban-v2/backup.sh >> /var/log/openclaw-kanban-backup.log 2>&1
set -euo pipefail

COMPOSE_DIR="/home/ubuntu/openclaw-kanban-v2"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.prod.yml"
BACKUP_DIR="/var/backups"
DATE=$(date +%F)
LOG="[kanban-backup $DATE]"

mkdir -p "$BACKUP_DIR"
echo "$LOG Starting..."

# 1. Postgres dump (custom format: supports parallel restore + selective objects)
echo "$LOG pg_dump..."
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump --format=custom -U openclaw openclaw_kanban \
  > "$BACKUP_DIR/openclaw-kanban-$DATE.pgdump"
echo "$LOG pg_dump done ($(du -sh "$BACKUP_DIR/openclaw-kanban-$DATE.pgdump" | cut -f1))"

# 2. Attachments volume
echo "$LOG attachments..."
docker run --rm \
  -v openclaw-kanban-v2_attachments:/src:ro \
  -v "$BACKUP_DIR":/dst \
  alpine tar -czf "/dst/openclaw-kanban-attachments-$DATE.tar.gz" -C /src .
echo "$LOG attachments done"

# 3. Purge local copies older than 14 days
find "$BACKUP_DIR" -name 'openclaw-kanban-*' -mtime +14 -delete
echo "$LOG old backups purged"

echo "$LOG Done."
