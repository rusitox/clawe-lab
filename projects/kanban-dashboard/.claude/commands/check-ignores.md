---
allowed-tools: Read, Bash(git:*), Glob
description: Verify .gitignore is properly configured
---

1. Read `.gitignore`
2. Check for common missing entries: `.env*`, `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `.mypy_cache/`, `.ruff_cache/`, `.pytest_cache/`, `node_modules/`, `dist/`, `coverage/`, `.claude/settings.local.json`
3. Check for tracked files that should be ignored: `git ls-files -i --exclude-standard`
4. Check for sensitive files accidentally tracked: `git ls-files | grep -iE '\.env|secret|credential|\.pem|\.key|kanban_token'`
5. Special check for this project: ensure `tasks.json`, `activity.json`, `teams.json` policy is explicit (commit empty seed vs ignore live data)
6. Report findings and suggest fixes
