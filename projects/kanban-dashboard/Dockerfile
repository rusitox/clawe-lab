# syntax=docker/dockerfile:1.6
#
# Clawe Kanban v2 — production image.
# Multi-stage: builder installs deps into /opt/venv; runtime copies only that
# venv + the source. Non-root user. ~150 MB compressed.

# ---------- builder ----------
FROM python:3.11-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY pyproject.toml README.md ./
# Hatchling reads pyproject + README to validate metadata. We don't ship our
# own package — we just need the deps installed in /opt/venv. The dummy `server`
# stub keeps `pip install .` happy without copying the real source (better cache).
RUN mkdir -p server && touch server/__init__.py

# Build isolated venv with all production deps (no dev extras).
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install --no-cache-dir .

# ---------- runtime ----------
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_HOME=/app \
    ATTACHMENTS_DIR=/app/var/attachments

# libpq5 → psycopg runtime; libmagic1 → python-magic; tini → PID 1; curl → healthcheck.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq5 libmagic1 ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system app \
 && useradd --system --uid 1000 --gid app --home "$APP_HOME" --shell /usr/sbin/nologin app

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=app:app alembic.ini pyproject.toml ./
COPY --chown=app:app server ./server
COPY --chown=app:app static ./static
COPY --chown=app:app docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh \
 && mkdir -p "$ATTACHMENTS_DIR" \
 && chown -R app:app /app

USER app
EXPOSE 8787

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8787/api/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8787", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
