---
allowed-tools: Read, Write, Bash, Glob, Grep
description: Sync .claude/ with the latest claude-bootstrap templates, preserving agent memory
---

Upgrade this project's Claude Code configuration to the latest templates.

## Step 1: Protect agent memory

Read `.claude/agent-memory/` to understand what accumulated knowledge exists —
this context informs the upgrade report but is **never modified**.

```bash
ls -la .claude/agent-memory/ 2>/dev/null && \
  find .claude/agent-memory -name "*.md" | head -20 || echo "No agent memory found"
```

Report what memory was found (e.g., "planner has 3 memory files, qa has 2").

## Step 2: Inventory current .claude/

```bash
find .claude -type f | grep -v agent-memory | grep -v settings.local.json | sort
```

Identify:
- Which standard commands exist vs which are missing
- Which standard agents exist vs which are missing
- Any custom commands or agents (not in the standard set — preserve these untouched)

Standard commands: prime, plan, implement, validate, commit, create-pr, review-pr,
prd, rca, check-ignores, create-command, create-rules, design, sync

Standard agents: planner, code-reviewer, qa, frontend, design, backend, database, devops

## Step 3: Extract current placeholder values

Read existing generated files to recover the project-specific values:

```bash
cat .claude/commands/validate.md 2>/dev/null
cat .claude/commands/implement.md 2>/dev/null
cat .claude/agents/planner.md 2>/dev/null
cat .claude/agents/frontend.md 2>/dev/null
cat .claude/settings.json 2>/dev/null
cat CLAUDE.md 2>/dev/null
```

## Step 4: Find skill templates

```bash
ls ~/.claude/skills/claude-bootstrap/assets/templates/ 2>/dev/null
```

## Step 5: Present upgrade plan

Show a clear summary before making any changes — what will be updated,
added, preserved, and protected. Ask for confirmation before proceeding.

## Step 6: Apply updates

**Never touch:**
- `.claude/agent-memory/` — accumulated knowledge from all past sessions
- `.claude/settings.local.json` — personal overrides
- Any file not in the standard template set

## Step 7: Report

```
✅ Upgrade complete!
  Updated:    [list]
  Added:      [list]
  Skipped:    [list]
  Preserved:  .claude/agent-memory/ ([N] files intact)
```
