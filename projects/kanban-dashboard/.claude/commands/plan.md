---
allowed-tools: Read, Write, Bash, Glob, Grep
description: Create implementation plan and update sections 4 & 5 of the SDD
---

Plan implementation for: $ARGUMENTS

## Step 1: Locate the SDD

Check if `specs/sdd-[feature-name].md` exists.
- **If it exists**: read sections 1-3 before planning — requirements and design
  decisions must inform the architecture
- **If it doesn't exist**: warn that PRD hasn't been defined yet, create the SDD
  skeleton, then proceed

## Step 2: Invoke the planner agent

Hand off to the `planner` agent with:
- The full SDD content (sections 1-3 if available)
- The feature from $ARGUMENTS
- Instruction to produce architecture + implementation plan

## Step 3: Update SDD sections 4 & 5

Write or overwrite sections 4 and 5 of `specs/sdd-[feature-name].md`:

```markdown
## 4. Architecture

### Overview
[High-level design decisions and rationale]

### Data Model
[New or modified entities, schema changes]

### API Contracts
[Endpoints or functions: input, output, errors]

### Key Dependencies
[Libraries, services, or internal modules involved]

### Risks & Considerations
[Performance, security, backward compatibility]

---

## 5. Implementation Plan

### Phase 1: [Foundation]
- [ ] Task — `path/to/file.py`
- [ ] Task — complexity: low/medium/high

### Phase 2: [Core Logic]
- [ ] Task — `path/to/file.py`

### Phase 3: [Integration & Testing]
- [ ] Task — `path/to/file.py`

### Files to Create
- `path/to/new-file.py` — purpose

### Files to Modify
- `path/to/existing.py` — what changes
```

Also update section 7 (Open Questions) if new risks or pending decisions were identified.
