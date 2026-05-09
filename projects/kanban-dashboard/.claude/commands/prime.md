---
allowed-tools: Read, Glob, Bash
description: Prime agent with codebase context and active SDDs
---

Read these files to understand the codebase before starting work:

- `README.md` — project overview and how to run
- `server.py` — Python `http.server` backend, JSON-file persistence (v1)
- `app.js` — vanilla JS frontend (drag & drop, filters, activity feed)
- `index.html` — UI structure
- `styles.css` — styling
- `tasks.json`, `teams.json`, `activity.json` — current persistence (to be migrated to DB)
- `scripts/reconcile_kanban.py` — data reconciliation
- `systemd/openclaw-kanban.service.example` — deployment unit
- `.claude/agent-memory/` — accumulated knowledge from past sessions

Then run:
```bash
ruff check . && npx eslint app.js && mypy server.py
```

Then check for active feature specs:
```bash
ls specs/sdd-*.md 2>/dev/null || echo "No SDDs found"
```

For each SDD found, read it and report:
- Feature name and current **Status** (Draft / In Review / Approved / Implemented)
- Which sections are complete vs pending
- Any open questions from section 7

Confirm all checks pass and summarize the project state before proceeding.
