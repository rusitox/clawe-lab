---
allowed-tools: Read, Bash, Glob
description: Run all validation checks on the codebase
---

Run comprehensive validation:

1. **Lint (Python)**: `ruff check .`
2. **Lint (JS)**:     `npx eslint app.js`
3. **Types**:          `mypy server.py`
4. **Build**:          `bash scripts/build.sh` (creates `dist/` artifact for systemd deploy)
5. **Tests**:          `pytest`
6. **Hygiene**: No `print()` in server code, no `console.log` in app.js (except dev utilities), no commented-out code, no `TODO` without issue numbers, no hardcoded tokens

Report:
```
✅/❌ Lint (py):  PASS/FAIL
✅/❌ Lint (js):  PASS/FAIL
✅/❌ Types:      PASS/FAIL
✅/❌ Build:      PASS/FAIL
✅/❌ Tests:      PASS/FAIL (X/Y passed)
⚠️  Warnings:    [list]
```
