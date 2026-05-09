---
allowed-tools: Read, Write, Bash, Glob, Grep
description: Review UX/UI design and update section 3 of the SDD
---

Design review for: $ARGUMENTS

## Step 1: Locate the SDD

Check if `specs/sdd-[feature-name].md` exists.
- **If it exists**: read it to understand the requirements before reviewing
- **If it doesn't exist**: create it with the full SDD skeleton first
  (same structure as `/project:prd`), then proceed

## Step 2: Survey existing design artifacts

```bash
# Vanilla JS — no component library; check for CSS organization
ls styles.css 2>/dev/null
grep -E "^(:root|--)" styles.css 2>/dev/null | head -20    # CSS custom properties / tokens

# Storybook (unlikely in vanilla setup, but check)
ls .storybook/ 2>/dev/null

# Figma references
grep -rn "figma.com" . --include="*.md" --include="*.html" --include="*.js" --include="*.css" 2>/dev/null | head -10
```

## Step 3: Invoke the design agent

Hand off to the `design` agent with:
- The feature from $ARGUMENTS (or recently modified UI files if empty)
- The requirements from the SDD (section 2)
- All design artifacts detected in Step 2
- Instruction to cover the 4 review areas

## Step 4: Update SDD section 3

Write or overwrite section 3 of `specs/sdd-[feature-name].md`:

```markdown
## 3. UI/UX Design

### Design Artifacts
[Figma links, CSS custom properties, components in app.js]

### Screens & Flows
[Key screens, user flows, states: loading / empty / error]

### Design System
[CSS custom property usage, component reuse in app.js, deviations]

### Component Architecture
[How interactive elements are structured, event handling, DOM updates]

### Accessibility
[ARIA requirements, keyboard nav, drag & drop a11y, contrast, focus management]

### Issues
| Severity | Area | Description | File |
|----------|------|-------------|------|
| 🔴 Critical | ... | ... | ... |
| 🟡 Warning  | ... | ... | ... |
| 🟢 Suggestion | ... | ... | ... |
```
