# Design preview — Clawe Kanban v2

Static HTML mockups of the key v2 screens using the design tokens proposed
in `specs/sdd-kanban-v2.md` §3. This directory is a **review artifact only**.
It is not the production frontend (that lives in Phase 5 of the implementation
plan, under `static/` + `server/templates/`).

Nothing here is wired to a backend; the data shown is hardcoded.

## How to view

```bash
python3 -m http.server 9000 -d design-preview
open http://127.0.0.1:9000
```

## What's covered

- `index.html` — preview index with links to every screen
- `login.html` — Google sign-in landing
- `projects.html` — project list (home)
- `board.html` — populated kanban board (desktop)
- `board-mobile.html` — board at mobile viewport (390 px)
- `task-drawer.html` — board with task detail drawer open
- `task-new.html` — board with task creation modal open (kind switcher)
- `members.html` — project members management
- `tokens-page.html` — API tokens management
- `empty.html` — empty / loading / error states reference
- `404.html` — error page

## How to give feedback

Open each screen, compare against §3.3 wireframes, and flag anything in §7
(`Open Questions`) that needs a different recommendation.
