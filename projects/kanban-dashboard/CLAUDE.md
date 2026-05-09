# Clawe Kanban Dashboard

Multi-tenant Kanban dashboard for Clawe and external users. Supports multiple
projects, multiple users, persistent database storage, and rich task data
(improvement proposals, bug reports, image attachments, etc.). Used as input
for downstream Clawe / OpenClaw projects.

**v1** is a single-tenant prototype with JSON-file persistence (`tasks.json`,
`activity.json`, `teams.json`) behind a Python `http.server` and a vanilla JS
frontend. **v2** is a redesign toward a real database, per-user auth, and
multi-tenant scoping. New features should be designed with v2 architecture in
mind even before the migration lands.

## Stack

- **Language**: Python 3 (backend) + Vanilla JavaScript (frontend)
- **Framework**: Python `http.server` (`ThreadingHTTPServer` + custom routing) — no web framework
- **Frontend**: vanilla JS / HTML / CSS — no React/Vue, no bundler
- **Package Manager**: `pip` for Python, `npm` only for `eslint` (dev tool)
- **Linter**: `ruff` (Python) + `eslint` (JS)
- **Type checker**: `mypy` (Python)
- **Testing**: `pytest`
- **Database**: JSON files today — moving to SQLite (dev) / Postgres (prod) via SQLAlchemy + Alembic
- **Deploy**: systemd unit running `python3 server.py` (see `systemd/openclaw-kanban.service.example`)

## Commands

```bash
# Run locally (v1)
export KANBAN_TOKEN='...'
python3 server.py                  # serves on :8787

# Validation (matches /project:validate)
ruff check .                       # lint Python
npx eslint app.js                  # lint JS
mypy server.py                     # type check
pytest                             # run tests
bash scripts/build.sh              # build dist/ artifact (TBD — see SDD)
```

## Key Files

- `server.py` — HTTP handler, JSON persistence, token auth, locking
- `app.js` — DOM rendering, drag & drop, filters, activity feed
- `index.html` / `styles.css` — UI structure and tokens (CSS custom properties)
- `tasks.json` / `activity.json` / `teams.json` — v1 persistence (will migrate)
- `scripts/reconcile_kanban.py` — data reconciliation utility
- `systemd/openclaw-kanban.service.example` — deployment unit
- `.claude/agents/` — specialized agents (planner, code-reviewer, qa, frontend, design, backend, database, devops)
- `.claude/rules/` — file-pattern conventions enforced by reviewers

## Multi-tenant constraints (v2)

These constraints are load-bearing and apply to every change once v2 lands:

- Every tenant-owned table carries `project_id NOT NULL`.
- Every API endpoint resolves `(user, project)` and scopes its queries to that tenant.
- Every new endpoint ships with a multi-tenant isolation test on day one.
- Cross-tenant leaks are always 🔴 Critical bugs.

## Specs

Feature design documents live in `specs/sdd-[feature-name].md`.
Each SDD is the single source of truth for a feature: requirements, UI/UX design,
architecture, and implementation plan. **Always read the relevant SDD before implementing.**

Commands that contribute to an SDD:
- `/project:prd` — sections 1 & 2 (Overview + Requirements)
- `/project:design` — section 3 (UI/UX Design)
- `/project:plan` — sections 4 & 5 (Architecture + Implementation Plan)

The v2 multi-tenant redesign is the first SDD to write — start there with `/project:prd kanban-v2`.

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
