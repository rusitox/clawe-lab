#!/bin/sh
# Container entrypoint: apply DB migrations, then exec the CMD (uvicorn).
# Idempotent — alembic only does work when there's a pending migration.
set -e

echo "[entrypoint] running alembic migrations…"
alembic upgrade head

echo "[entrypoint] handing off to: $*"
exec "$@"
