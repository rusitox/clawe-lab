# Clawe Kanban Dashboard

Multi-tenant Kanban dashboard for Clawe and external users. Supports multiple
projects, multiple users, PostgreSQL persistence, and rich task data
(improvement proposals, bug reports, image attachments, etc.). Used as input
for downstream Clawe / OpenClaw projects.

**v2 is live in production** at https://136-248-107-132.nip.io (Google OAuth,
FastAPI + Postgres, Docker deploy on Oracle VPS via GitHub Actions).

The old v1 files (`server.py`, `app.js`, `index.html`, `styles.css`,
`tasks.json`, `activity.json`, `teams.json`) still exist in the repo root but
are not served — cleanup is the remaining Phase 8 task.

## Stack

- **Language**: Python 3.13 (backend) + Vanilla JavaScript (frontend)
- **Framework**: FastAPI + uvicorn (ASGI, behind nginx reverse proxy)
- **Frontend**: vanilla JS / HTML / CSS — ES modules, no bundler, Jinja2 templates
- **Package Manager**: `pip` via `.venv`; `npm` only for `eslint` + `@playwright/test`
- **Linter**: `ruff` (Python) + `eslint` (JS)
- **Type checker**: `mypy` (Python)
- **Testing**: `pytest` (76 backend tests) + `@playwright/test` (e2e + visual regression)
- **Database**: PostgreSQL 16 via SQLAlchemy 2.0 + Alembic (Docker Compose locally, Docker on prod)
- **Deploy**: Docker Compose on Oracle VPS, managed by GitHub Actions (`kanban-ci.yml` + `kanban-deploy.yml`)

## Commands

```bash
# One-time setup
make install        # editable Python install + dev deps into .venv
make db-up          # start Postgres 16 on :5433 (Docker Compose)
make migrate        # alembic upgrade head
cp .env.example .env

# Run
make dev            # uvicorn with --reload on :8787

# Validation (matches /project:validate)
make lint           # ruff check . && npx eslint static/js
make typecheck      # mypy server scripts
make test           # pytest (76 tests)
make e2e            # Playwright e2e + visual regression (needs uvicorn running)
```

> `ruff`, `mypy`, and `pytest` are installed in `.venv` — they are not on
> the system PATH. Always activate `.venv` or use `make` targets.

## Key Files

- `server/` — FastAPI app (`main.py`, `config.py`, `db.py`, `deps.py`, `markdown.py`)
  - `server/auth/` — Google OAuth, cookie sessions, API tokens
  - `server/api/v2/` — all v2 endpoints (projects, tasks, teams, attachments, comments, activity, tokens, me)
  - `server/api/v1_legacy.py` — soft-cut v1 router (Deprecation/Sunset headers)
  - `server/models/` — SQLAlchemy models
  - `server/schemas/` — Pydantic v2 schemas
  - `server/services/` — activity writer, fractional ordering
  - `server/storage/` — StorageBackend protocol + filesystem impl
  - `server/migrations/` — Alembic versions
  - `server/templates/` — Jinja2 HTML shells
- `static/` — vanilla JS modules (`api.js`, `board.js`, `dnd.js`, `activity.js`, …) + CSS tokens
- `tests/` — pytest suite (multi-tenant isolation gate, auth, tasks, attachments, comments)
- `tests-e2e/` — Playwright behavioral + visual regression tests
- `deploy/` — `env.production`, `remote-deploy.sh`, `backup.sh`, nginx/secrets examples
- `Dockerfile` — multi-stage production image (pushed to `ghcr.io/rusitox/openclaw-kanban-v2`)
- `docker-compose.dev.yml` — local Postgres only
- `docker-compose.prod.yml` — full prod stack (db + app)
- `docs/ops.md` — operational runbook (deploy, rollback, backups, secrets rotation)
- `docs/ci-cd.md` — CI/CD architecture, decisions, lessons learned
- `docs/openclaw-skill.md` — integration guide for OpenClaw consumers
- `.claude/agents/` — specialized agents (planner, code-reviewer, qa, frontend, design, backend, database, devops)
- `.claude/rules/` — file-pattern conventions enforced by reviewers

## Multi-tenant constraints

These are load-bearing and enforced in production:

- Every tenant-owned table carries `project_id NOT NULL`.
- Every API endpoint resolves `(user, project)` via `get_project_member` and scopes its queries.
- Every new endpoint ships with a multi-tenant isolation test on day one.
- Cross-tenant leaks are always 🔴 Critical bugs — `get_project_member` returns 404 (not 403).

## Specs

Feature design documents live in `specs/sdd-[feature-name].md`.
Each SDD is the single source of truth for a feature: requirements, UI/UX design,
architecture, and implementation plan. **Always read the relevant SDD before implementing.**

The active SDD is `specs/sdd-kanban-v2.md` (Status: Implemented). Phases 0–7
are complete; Phase 8 (v1 file cleanup) is the only remaining task.

Commands that contribute to an SDD:
- `/project:prd` — sections 1 & 2 (Overview + Requirements)
- `/project:design` — section 3 (UI/UX Design)
- `/project:plan` — sections 4 & 5 (Architecture + Implementation Plan)

---

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
