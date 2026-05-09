---
globs:
  - "**/*.js"
---

# Vanilla JavaScript Conventions

- No frameworks (React/Vue/Svelte) without an SDD approving the migration.
- No build step / bundler — the file served must be the file shipped.
- `const` by default, `let` when reassignment is genuine, never `var`.
- camelCase for variables and functions, PascalCase for constructors.
- Always escape user-supplied strings before injecting into `innerHTML`. Prefer
  `textContent` for plain text, or build nodes with `createElement`/`append`.
- Event delegation: attach listeners on stable parents, read `data-*` attributes
  to identify the target — avoid `addEventListener` per card.
- No `console.log` in committed code (debug utilities behind a flag are fine).
- Token storage: `localStorage` under documented keys (e.g., `clawe_kanban_token_v1`).
- Drag & drop must have a keyboard equivalent (a11y P0).
- Reference design tokens via CSS custom properties — no hardcoded colors in JS.
