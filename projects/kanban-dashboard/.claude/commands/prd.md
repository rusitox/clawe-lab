---
allowed-tools: Read, Write, Glob
description: Define requirements and create or update the SDD for a feature
---

Define requirements for: $ARGUMENTS

1. Clarify the problem statement and target users
2. Write user stories with acceptance criteria
3. Classify requirements: P0 (must have), P1 (should have), P2 (nice to have)
4. Define non-functional requirements: performance, security, accessibility
5. Identify technical considerations and external dependencies

Then create or update `specs/sdd-[feature-name].md`:

- **If the file doesn't exist**: create it with the full SDD skeleton below,
  filling in sections 1 and 2. Mark all other sections as `> Pending`.
- **If the file exists**: overwrite only sections 1 and 2. Preserve everything else.

```markdown
# SDD: [Feature Name]

**Status:** Draft
**Last updated:** [date]

---

## 1. Overview

### Problem
[What problem does this solve and why does it matter?]

### Goals
[Measurable success criteria]

### Out of scope
[What this feature explicitly does NOT cover]

---

## 2. Requirements

### Functional

| Priority | User Story | Acceptance Criteria |
|----------|-----------|---------------------|
| P0 | As a [user], I want to... | Given... When... Then... |

### Non-functional

- **Performance**: [response times, load targets]
- **Security**: [auth, data sensitivity, threat model]
- **Accessibility**: [WCAG level, specific requirements]

---

## 3. UI/UX Design

> Pending — run `/project:design [feature]`

---

## 4. Architecture

> Pending — run `/project:plan [feature]`

---

## 5. Implementation Plan

> Pending — run `/project:plan [feature]`

---

## 6. Testing Strategy

> Pending — filled by QA agent during implementation

---

## 7. Open Questions

- [ ] [Question or decision pending]
```
