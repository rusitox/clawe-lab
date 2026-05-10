# Clawe Kanban Dashboard (v2)

Multi-tenant Kanban dashboard for Clawe and OpenClaw users. FastAPI + Postgres
backend, vanilla JS frontend, deployed via Docker on an Oracle Cloud VPS with
GitHub Actions CI/CD.

**Live:** https://136-248-107-132.nip.io
**Sign in:** Google OAuth
**API:** `/api/v2/*` (legacy `/api/{tasks,activity,teams}` is soft-cut behind a feature flag)

## Features

- **Multi-tenant**: each user can be a member of multiple projects, with per-project roles (owner / member / viewer)
- **Three task kinds**: task, bug, proposal — same kanban, different metadata
- **Attachments**: per-task images with size + mime allow-listing
- **Comments + activity feed** with audit trail
- **Drag & drop** with keyboard fallback (a11y)
- **Per-team color accents** picked from a fixed palette
- **Stable v2 API** consumable by OpenClaw and other Clawe services

## Quick start (local dev)

```bash
# 1. One-time setup
make install        # editable Python install + dev deps into .venv
make db-up          # starts Postgres 16 in Docker on :5433
make migrate        # alembic upgrade head
cp .env.example .env  # edit DATABASE_URL etc. as needed

# 2. Run
make dev            # uvicorn with reload on :8787

# 3. Validate
make test           # 76 pytest cases
make lint           # ruff + eslint
make typecheck      # mypy
make e2e            # Playwright e2e + visual regression (slow)
```

The `Makefile` has the full target list — `make help` to see them all.

## Project structure

```
projects/kanban-dashboard/
├── server/             # FastAPI app (api/, deps.py, db/, models/, schemas/, services/)
├── server/migrations/  # Alembic
├── static/             # Vanilla JS / CSS / HTML — no bundler
├── tests/              # pytest (76 tests, includes multi-tenant isolation gate)
├── tests-e2e/          # Playwright (smoke + visual regression)
├── scripts/            # CLI utilities (import_v1.py, etc.)
├── deploy/             # env.production, remote-deploy.sh, SECRETS.md, nginx.conf.example
├── docker/             # Dockerfile entrypoint
├── docs/               # ops.md (runbook), ci-cd.md (architecture + lessons)
├── specs/              # SDD — single source of truth for design decisions
├── Dockerfile          # multi-stage prod image
├── docker-compose.dev.yml  # local Postgres only
└── docker-compose.prod.yml # full prod stack (db + app)
```

## Deploy

Push to `main` → `Kanban CI` runs (lint + types + pytest + Playwright + Docker
build) → on green, `Kanban Deploy (Oracle VPS)` builds the multi-arch image,
pushes to GHCR, SSHs to the VPS, and runs the atomic `remote-deploy.sh`.

**For step-by-step deploy commands:** [`docs/ops.md`](./docs/ops.md)
**For architecture, decisions, and lessons learned:** [`docs/ci-cd.md`](./docs/ci-cd.md)
**For GitHub Secrets setup:** [`deploy/SECRETS.md`](./deploy/SECRETS.md)

## Integrations

- **OpenClaw → Kanban:** see [`docs/openclaw-skill.md`](./docs/openclaw-skill.md)
  for the full integration skill (v2 API auth, multi-tenant model, endpoint
  catalog, 8 ready-to-paste curl recipes, error model). OpenClaw operates as
  a regular user (`clawe.bot@gmail.com`) with its own per-user API token.

## Specs

Feature design lives in [`specs/sdd-kanban-v2.md`](./specs/sdd-kanban-v2.md).
**Always read the SDD before implementing** — it's the source of truth for
multi-tenant model, API surface, UI design picks (Stitch), and migration plan.

## Multi-tenant constraints

These are load-bearing and apply to every change:

- Every tenant-owned table carries `project_id NOT NULL`.
- Every API endpoint resolves `(user, project)` and scopes its queries to that tenant.
- Every new endpoint ships with a multi-tenant isolation test on day one.
- Cross-tenant leaks are always 🔴 Critical bugs — see `tests/test_isolation_gate.py`.

## Legacy v1

The `/api/{tasks,activity,teams}` surface stays behind `LEGACY_KANBAN_TOKEN`
until OpenClaw migrates to `/api/v2/*`. Currently disabled (env var empty →
endpoints return 503). See `docs/ops.md §8` for the cutover procedure.

The original v1 prototype (`server.py` + JSON files + vanilla JS) lives in
git history; nothing v1 runs in production. To browse it:
`git log --all --oneline -- server.py app.js | head`.
