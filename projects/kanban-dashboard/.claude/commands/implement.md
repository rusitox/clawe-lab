---
allowed-tools: Read, Write, Bash, Glob, Grep
description: Implement a feature or task following the SDD
---

Implement: $ARGUMENTS

## Step 1: Check for SDD

Look for `specs/sdd-[feature-name].md`:

```bash
ls specs/sdd-*.md 2>/dev/null
```

- **If found**: read the full SDD. Sections 4 & 5 are your implementation guide.
  Section 3 (UI/UX) and section 2 (Requirements) define what done looks like.
- **If not found**: warn the user that no SDD exists for this feature.
  Ask whether to proceed without one or run `/project:plan` first.

## Step 2: Implement following the SDD

Work through section 5 (Implementation Plan) phase by phase:
- Check off tasks as they are completed
- Follow architecture decisions from section 4
- Match UI/UX spec from section 3
- Validate after each phase:
  ```bash
  ruff check . && npx eslint app.js && mypy server.py
  ```

## Step 3: Follow project conventions

- Follow Python 3 + Vanilla JS conventions (see `.claude/rules/`)
- No hardcoded values, no `print()` in server code (use `logging`), clean imports
- Add error handling only at system boundaries (HTTP layer, DB layer)
- All Python code must have type hints (enforced by mypy)

## Step 4: Update the SDD

When implementation is complete, update `specs/sdd-[feature-name].md`:
- Change **Status** to `Implemented`
- Fill in section 6 (Testing Strategy) with what was tested and how
- Close any resolved items in section 7 (Open Questions)

## Step 5: Self-review

Before presenting: verify the implementation satisfies all P0 requirements
from section 2, and all acceptance criteria are met.
