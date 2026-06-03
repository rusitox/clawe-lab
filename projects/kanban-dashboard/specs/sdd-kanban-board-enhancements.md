# SDD: Kanban Board Enhancements

**Status:** Implemented
**Last updated:** 2026-06-03

---

## 1. Overview

### Problem

Three gaps in the current board (v2, in production) block a clean ticket lifecycle:

1. **No verification step.** Work moves directly from *In progress* to *Done*
   with no human checkpoint. There's no way to mark a task as "finished but
   waiting for someone to verify it" before closing it — the ticket either sits
   in *In progress* or gets marked Done prematurely.

2. **Description absent from task creation.** The *New task* dialog exposes
   kind, title, column, and priority — but no description field. Users have to
   create the task and then open the drawer to add context. For bugs and
   proposals this is especially disruptive because meaningful content (repro
   steps, motivation) belongs at creation time.

3. **Done is a dead end.** Completed tasks pile up in the *Done* column
   indefinitely, cluttering the board and making the signal-to-noise ratio worse
   over time. There is no way to retire closed work while still keeping it
   accessible for reference, auditing, or re-opening.

### Goals

| # | Goal | Measurable criterion |
|---|------|----------------------|
| G1 | Ship a *Verificación* column between *In progress* and *Done* | Column renders on the board; tasks can be moved there via DnD and keyboard; transitions to Done and to In progress work end-to-end |
| G2 | Description field available at creation time | The *New task* dialog accepts a description; it is saved to `description_md` and rendered as sanitized HTML in the drawer |
| G3 | Archive lifecycle for Done tasks | Tasks in Done can be manually archived; the board hides archived tasks by default; an *Archive* view inside the project lists them sorted by `archived_at`; a weekly automated job archives all tasks that have been Done for ≥ 7 days |

### Out of scope

- **Automated verification** — CI/CD triggering column transitions (e.g., "test
  suite green → auto-move to Verification"). This is an OpenClaw integration
  concern, not a board UX concern.
- **Bulk archive** — selecting multiple Done tasks and archiving at once.
- **Archive across projects** — the archive view is scoped to one project.
- **Notifications / reminders** — no email or in-app alert when tasks auto-archive.
- **Per-column auto-archive rules** — only Done tasks auto-archive; no rules for other columns.

---

## 2. Requirements

### Functional requirements

#### Feature A — Verificación column

| Priority | Capability | User story | Acceptance criteria |
|----------|-----------|------------|---------------------|
| **P0** | **New column in the workflow** | As a member, I want to move a task to a *Verificación* column so that I can signal it is ready for human review before closing it. | The board renders five active columns in order: Backlog → Todo → In progress → **Verificación** → Done. The column appears for all project members immediately (no opt-in). |
| **P0** | **Drag to Verificación** | As a member, I want to drag a card into Verificación from any other column. | DnD works exactly as it does for the existing columns; dropping a card into Verificación updates `column = 'verification'` and logs an activity event `task.moved`. |
| **P0** | **Transition from Verificación to Done** | As a verifier, I want to close a verified task with one action. | From the task drawer, a primary button *"Mark as Done"* moves the task to Done; DnD into Done also works. Activity event logged. |
| **P0** | **Transition from Verificación back to In progress** | As a verifier, I want to reject a task and send it back to the team. | From the task drawer, a secondary button *"Back to In progress"* moves the task; DnD into In progress also works. Activity event logged. |
| **P0** | **Keyboard DnD parity** | As a keyboard user, I want to move cards to/from Verificación without a mouse. | The existing keyboard DnD (Space to lift, arrows to navigate columns, Space to drop, Escape to cancel) includes Verificación as a valid destination and source. |
| **P0** | **Column count pill** | As a member, I want to see how many tasks are pending verification at a glance. | The column header shows the live count, same styling as other columns. |
| **P1** | **Column-level quick add** | As a member, I can add a task directly into Verificación via the "+ Add task" button on the column footer. | The *New task* dialog pre-selects *Verificación* as the column. |

#### Feature B — Description on task creation

| Priority | Capability | User story | Acceptance criteria |
|----------|-----------|------------|---------------------|
| **P0** | **Description textarea in New task dialog** | As a member, I want to write a description while creating a task so that context is captured from the start. | The *New task* dialog shows a *Description (markdown)* textarea below the Title field. The textarea is optional (no required attribute). Max 10 000 chars client-side. |
| **P0** | **Description saved on create** | The server persists the markdown and renders sanitized HTML. | `POST /api/v2/projects/{id}/tasks` with `description_md` populated returns the task with both `description_md` and `description_html` filled. Existing tasks with empty description are unaffected. |
| **P0** | **Kind-specific pre-fill** | As a member creating a bug or proposal, I want the description pre-filled with a template so I don't have to remember the structure. | Selecting *Bug* pre-fills the textarea with `## Steps to reproduce\n\n## Expected\n\n## Actual\n`; selecting *Proposal* pre-fills with `## Why\n\n## What\n`. Switching back to *Task* clears to blank. Editing the pre-fill before submitting works normally. |
| **P1** | **Description in drawer** | Existing description editing in the task drawer is unchanged. | No regression: descriptions saved at creation appear correctly in the drawer's markdown view. |

#### Feature C — Archive lifecycle

| Priority | Capability | User story | Acceptance criteria |
|----------|-----------|------------|---------------------|
| **P0** | **Manual archive from Done** | As a member, I want to archive a Done task so that the board stays clean. | A card in the Done column shows an *Archive* action directly on the card. The drawer also exposes the same action. Either triggers `archived_at = now()`. The card disappears from the main board immediately. Activity event `task.archived` logged. |
| **P0** | **Board hides archived tasks** | As a member, I want the main board to only show active work. | The default board query (`GET /api/v2/projects/{id}/tasks`) excludes tasks where `archived_at IS NOT NULL`. Archived tasks never appear in any column on the board. |
| **P0** | **Archive view within the project** | As a member, I want to browse archived tasks. | A new route `/p/{slug}/archive` renders a list of archived tasks for the project, sorted by `archived_at DESC`. Each entry shows title, kind badge, priority, the column it was in when archived, and the archive date. Clicking an entry opens the task drawer (read-only). |
| **P0** | **Auto-archive of Done tasks** | As a project owner, I want Done tasks older than a configurable number of days to be automatically archived. | A scheduled job runs every Sunday at 03:00 UTC. For each project where `auto_archive_days IS NOT NULL AND auto_archive_days > 0`, it sets `archived_at = now()` on all non-deleted, non-archived tasks where `column = 'done'` AND `updated_at < now() - interval '{auto_archive_days} days'`. The job is idempotent. Activity event `task.archived` logged per task with `payload = {"auto": true}`. |
| **P0** | **Multi-tenant safety of the archive job** | The job must not cross tenant boundaries. | The job is a project-scoped SQL `UPDATE` with `project_id` in the WHERE clause; it runs across all projects in a single transaction per project. A non-member cannot trigger or observe archival of another project's tasks. |
| **P1** | **Archive count in project list** | As a member, I want to see how many tasks are archived without entering the archive view. | The project card on the home page and/or a link in the project topbar shows the total archived count. |
| **P1** | **Archive search / filter** | As a member, I want to filter the archive view by kind, priority, or keyword. | The archive view supports `?kind=`, `?priority=`, `?q=` query params (same API params as the board). |
| **P1** | **Unarchive with column picker** | As a member, I want to restore an archived task to any active column. | From the archive view, each task has a *Restore* action that opens a column picker (Backlog / Todo / In progress / Verification / Done); on confirm, `archived_at` is cleared and `column` is updated. Activity event `task.unarchived` logged with `payload = {"restored_to": column}`. |

### Non-functional requirements

**Performance**
- The weekly archive job completes in ≤ 10 s for a project with 1 000 Done tasks.
- The `/p/{slug}/archive` page renders the latest 50 archived tasks in ≤ 200 ms p95 (indexed by `archived_at DESC`).
- No regression on board load time — the `archived_at IS NULL` filter uses the existing `ix_tasks_project_column_position` index direction; a new partial index on `(project_id, archived_at DESC)` covers the archive view.

**Security**
- The archive auto-job endpoint (`POST /api/v2/internal/archive-done`) is protected by a shared `INTERNAL_SECRET` env var (Bearer token); it is **not** a user-facing endpoint and must not appear in the public OpenAPI docs (`include_in_schema=False`).
- The `INTERNAL_SECRET` is ≥ 32 random hex bytes, stored in GitHub Secrets (`INTERNAL_SECRET`) and injected via `deploy/env.production`.
- All task mutation endpoints (including archive) remain scoped by `get_project_member`; the internal job bypasses user auth but uses a service-level DB connection, not a user session.
- The archive view at `/p/{slug}/archive` is member-only (same auth as the board).

**Accessibility (WCAG 2.1 AA)**
- The *Verificación* column participates in keyboard DnD identically to existing columns.
- The description textarea has a proper `<label>` and is announced by screen readers.
- The *Archive* and *Back to In progress* buttons in the drawer have descriptive `aria-label` attributes.
- The archive view list uses `role="list"` / `role="listitem"`; archived date is in `<time datetime="...">`.

**Observability**
- Every manual and automatic archive action produces an `activity_events` row with `kind = 'task.archived'` and `payload = { "auto": true/false }`.
- The archive job logs the count of tasks archived per project at INFO level.

---

## 3. UI/UX Design

### 3.1 Design artifacts inventory

**CSS custom properties** — all tokens live in `static/css/tokens.css`. The full
set in use:

```
Color: --color-bg, --color-surface, --color-surface-raised, --color-border,
       --color-text, --color-text-muted, --color-text-on-brand,
       --color-brand-{50,500,600,700},
       --color-success-500, --color-warning-{50,500}, --color-danger-{50,500},
       --color-info-500,
       --color-kind-{task,bug,proposal}

Font:  --font-{xs,sm,md,lg,xl,2xl}, --line-md,
       --weight-{regular,medium,semibold}

Space: --space-{1,2,3,4,6,8,12}

Radius: --radius-{sm,md,lg,pill}

Shadow: --shadow-{sm,md,lg}

Motion: --motion-fast (120ms ease-out), --motion-base (200ms ease)
        Both collapse to 0 ms inside @media (prefers-reduced-motion: reduce)
```

**Existing component classes** (from `static/css/styles.css`) reused or extended
by this feature set:

- Board: `.board`, `.column`, `.column-header`, `.column-count`, `.column-list`,
  `.column-add`, `.column-empty`
- Cards: `.task-card`, `.task-card[data-kind]`, `.task-card--p0-bug`,
  `.task-card--dim`, `.task-card__row`, `.task-card__title`, `.task-card__footer`
- Drawer: `.drawer`, `.drawer-header`, `.drawer-header__meta`, `.drawer-body`,
  `.drawer-section`, `.drawer-footer`, `.drawer-title`
- Dialog: `dialog#new-task-dialog`, `.kind-switcher`, `.field`, `.field-row`
- Chips: `.kind-badge`, `.priority-chip`
- Utilities: `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.btn-block`,
  `.banner`, `.banner-error`, `.muted`, `.sr-only`, `.spacer`, `.textarea`

**Per-team colors** — bound at runtime via inline `style="--team-color: #hex"` on
column containers and cards. Not relevant to these three features (no new team
color surface is introduced).

**Figma** — none. Design is driven by Markdown wireframes + CSS tokens, consistent
with `sdd-kanban-v2.md §3`.

**Storybook** — none.

**Design heritage constraints for these features:**
- The board's single horizontal scroll area must absorb the fifth column without
  overflow hiding on desktop; the existing `grid-template-columns: repeat(4, …)`
  must grow to `repeat(5, …)`.
- Drawer footer is the product's primary "what's next" surface. Every footer
  state must be intentional and unambiguous.
- Cards are dense. Archive affordances on cards must not add visual noise to
  non-Done columns.

---

### 3.2 Information architecture (new/changed routes only)

| Route | Purpose | Auth | Change |
|-------|---------|------|--------|
| `/p/{slug}` | Project board | member | 5-column layout; archive button on Done cards |
| `/p/{slug}/archive` | Archived task list | member | **New** |
| `/p/{slug}/settings` | Project settings | owner | **New** "Auto-archive" section |

The `/p/{slug}/archive` page is a flat list (not a board). It is linked from the
topbar of the board page with a small secondary link ("Archive →") and from the
Done column footer. No new top-level nav entry needed — the board topbar already
has the right anchoring point.

The `/p/{slug}/settings` page does not yet exist as a rendered route in the
codebase (the SDD v2 §3.2 listed it, but Phase 5 did not implement it). This
feature requires its creation. It is an owner-only page.

---

### 3.3 Screens & flows

#### 3.3.1 Board with Verification column

**Desktop (1280 px wide, 5 columns):**

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  🐾 Clawe Kanban / Project ▼   [Mine] [All kinds ▾] [Members] [Activity] [Archive →]    │
│                                                                    👤 [API tokens] [+Task]│
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Backlog (4)    Todo (3)    In progress (2)    Verification (1)    Done (12)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      ┌──────────┐       ┌──────────┐          │
│  │T  title  │  │B P0 title│  │P  title  │      │T  title  │       │T  title  │          │
│  │ 👤       │  │ 👤  💬3  │  │ 👤       │      │ 👤       │       │ 👤  [Arch]│          │
│  └──────────┘  └──────────┘  └──────────┘      └──────────┘       └──────────┘          │
│  ┌──────────┐  ┌──────────┐                                        ┌──────────┐          │
│  │T  title  │  │T  title  │                                        │B  title  │          │
│  └──────────┘  └──────────┘                                        │ 👤  [Arch]│          │
│                                                                    └──────────┘          │
│  [+ Add task]  [+ Add task]  [+ Add task]      [+ Add task]       [+ Add task]          │
│                                                                    Archive →             │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Notes:
- The `.board` grid changes from `repeat(4, minmax(280px, 1fr))` to
  `repeat(5, minmax(240px, 1fr))`. Minimum column width shrinks from 280 px to
  240 px to keep all five columns visible at 1280 px without horizontal scroll.
- At ≤ 900 px the board already collapses to a single column (`grid-template-columns: 1fr`);
  that breakpoint is unchanged. The Verification column appears in the natural
  document order between In progress and Done, so single-column stacking is correct.
- The "Archive →" link is a small `.btn .btn-ghost .btn-sm` positioned in the
  Done column footer, below the `[+ Add task]` button. It is also echoed in
  the topbar (see topbar wireframe above) as a secondary link.
- The `[Arch]` archive button on Done cards is detailed in §3.3.3.

**Column header counts** — the Verification column header uses the same
`.column-count` pill as all other columns. No special visual treatment.

**Mobile (390 px, single-column stacked):**

```
┌──────────────────────────┐
│ ☰ 🐾 Project ▼  👤 + 🔍 │
├──────────────────────────┤
│  Verification (1)        │
│ ┌──────────────────────┐ │
│ │T  Title pending verif│ │
│ │ 👤                   │ │
│ └──────────────────────┘ │
├──────────────────────────┤
│ ◄ Backlog · Todo ·       │
│   In progress ·          │
│   Verification · Done ►  │
└──────────────────────────┘
```

The column-tab strip at the bottom gains a fifth tab "Verification" between
"In progress" and "Done".

---

#### 3.3.2 New-task dialog with description field

**Default state (kind = Task):**

```
┌─────────────────────────────────────────────────┐
│ New task                                    ✕   │
│                                                 │
│  ◉ Task    ◯ Bug    ◯ Proposal                  │
│                                                 │
│  Title                                          │
│  [_____________________________________________] │
│                                                 │
│  Description (markdown, optional)               │
│  ┌─────────────────────────────────────────┐   │
│  │                                         │   │
│  │                                         │   │
│  │                                         │   │
│  │                                         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Column:    [Backlog ▼]  Priority: [P2 ▼]       │
│                                                 │
│                   [Cancel Esc]  [Create ⌘Enter] │
└─────────────────────────────────────────────────┘
```

**After kind = Bug selected (pre-fill visible):**

```
┌─────────────────────────────────────────────────┐
│ New task                                    ✕   │
│                                                 │
│  ◯ Task    ◉ Bug    ◯ Proposal                  │
│                                                 │
│  Title                                          │
│  [_____________________________________________] │
│                                                 │
│  Description (markdown, optional)               │
│  ┌─────────────────────────────────────────┐   │
│  │ ## Steps to reproduce                   │   │
│  │                                         │   │
│  │ ## Expected                             │   │
│  │                                         │   │
│  │ ## Actual                               │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Column:    [Backlog ▼]  Priority: [P2 ▼]       │
│                                                 │
│                   [Cancel Esc]  [Create ⌘Enter] │
└─────────────────────────────────────────────────┘
```

**After kind = Proposal selected (pre-fill visible):**

```
  Description (markdown, optional)
  ┌─────────────────────────────────────────┐
  │ ## Why                                  │
  │                                         │
  │ ## What                                 │
  └─────────────────────────────────────────┘
```

**Layout decisions:**
- The description `<textarea>` sits between the Title `.field` and the
  `.field-row` (Column / Priority). This matches the §7-resolved requirement
  and the existing SDD v2 §3.3.6 wireframe ordering.
- The textarea uses the existing `.textarea` class (monospace font, resize-vertical,
  token-based border/padding). No new class is needed.
- `rows="4"` gives ~80 px height at `--font-sm`; the user can resize vertically.
- `maxlength="10000"` is set as a `data-maxlength` attribute; a character counter
  `<span>` below the textarea shows `0 / 10 000` in `--color-text-muted /
  --font-xs` and turns `--color-danger-500` when ≥ 9 500 chars. The counter is
  tied to the textarea via `aria-describedby`.
- The label reads "Description (markdown, optional)" — one `<label>` element,
  `for="nt-description"`.
- **Pre-fill logic**: the kind radio change handler sets the textarea value to
  the template string IF AND ONLY IF the current value equals `""` OR equals the
  previous kind's template string. This prevents overwriting user edits. The
  "clean pre-fill" check uses a module-level `lastPrefill` variable tracking the
  last value injected by the radio handler.
- The dialog width stays at `min(520px, 90vw)` — no change.

**Column select option added:** the new-task dialog's `<select id="nt-column">`
currently has Backlog / Todo / In progress. A "Verification" option must be
added so tasks can be created directly into that column (P1 requirement). It is
inserted between "In progress" and a new "Done" option. "Done" was previously
absent from the select (reasonable — creating tasks directly into Done is
unusual but the requirement now lists five columns).

---

#### 3.3.3 Done card — Archive action

**Card in Done column (normal state):**

```
┌──────────────────────────────────┐
│ T   Title of completed task      │
│ 👤 Marian                        │
│                        [Archive] │
└──────────────────────────────────┘
```

**Card in any other column (Backlog / Todo / In progress / Verification):**

```
┌──────────────────────────────────┐
│ T   Title of task                │
│ 👤 Marian                        │
│                                  │
└──────────────────────────────────┘
```

The Archive button does NOT appear.

**Design decisions:**
- The archive `<button>` is added to the `.task-card__footer` as a right-aligned
  ghost button, rendered only when `data-column="done"`.
- Class: `.btn .btn-ghost .btn-sm .task-card__archive`. Text: "Archive".
  No icon — text is clearer and keeps the card legible.
- The button is `hidden` by default in the `<template id="task-card-template">`
  and revealed in `renderTask()` when `task.column === "done"`.
- **Interaction pattern: undo toast** (preferred over a confirm dialog). Clicking
  "Archive" triggers the API call immediately and removes the card from the board.
  A dismissible toast appears: "Task archived. [Undo]" — auto-dismisses after
  8 seconds. If the user clicks "Undo", the API call `DELETE
  /api/v2/projects/{id}/tasks/{task_id}/archive` restores the task. The 8-second
  window is long enough to catch accidental clicks without being intrusive.
  Rationale: a confirm dialog interrupts flow for a reversible action; an undo
  toast is the pattern already established by the activity feed's reversibility
  model. The confirm dialog pattern is reserved for irreversible actions (delete).
- The archive button must stop click-event propagation so clicking "Archive" does
  NOT open the task drawer.
- `aria-label="Archive task: {title}"` on the button (title escaped).

**New CSS class `.task-card__archive`:**

```css
.task-card__archive {
  /* Ghost button, hidden by default, only surfaced in Done column */
  color: var(--color-text-muted);
  font-size: var(--font-xs);
}
.task-card__archive:hover {
  color: var(--color-text);
}
```

The button is positioned inside `.task-card__footer` on the right side, next to
the counters. The footer becomes a three-slot flex row:
`[assignees] [spacer] [counters] [archive-btn]`.

---

#### 3.3.4 Drawer — Verification state (Mark as Done + Back to In progress)

**Drawer footer when `task.column = "verification"`:**

```
┌───────────────────────────────────────────────────┐
│ T    Verification     ✕ Close                     │
│ ─────────────────────────────────────────────────  │
│ Title of the task                                  │
│ ─ Description ──────────────────────────────────  │
│ …                                                  │
│ ─ Attachments ──────────────────────────────────  │
│ ─ Comments ─────────────────────────────────────  │
│ ─────────────────────────────────────────────────  │
│ [Delete]  [Back to In progress]  [Mark as Done]   │
└───────────────────────────────────────────────────┘
```

Footer layout detail:
```
[Delete]         [spacer]    [Back to In progress]  [Mark as Done]
.btn             flex:1      .btn .btn-ghost         .btn .btn-primary
(destructive,               (secondary —            (primary —
 left side)                  moves to inprogress)    moves to done)
```

**Drawer footer when `task.column = "inprogress"`:**

```
│ [Delete]       [spacer]       [Move to Verification]   │
│ .btn                          .btn .btn-primary        │
```

(This replaces the current "Move to Done" primary button for in-progress tasks.)

**Drawer footer when `task.column = "done"`:**

```
│ [Delete]  [Archive]  [spacer]                      │
│ .btn      .btn-ghost                               │
│                      (no move button — already done) │
```

The current "Already done" text label is replaced: the Archive button takes the
left/center position. No primary action button for done tasks. The `[spacer]`
fills the right side.

**Drawer footer states — complete reference table:**

| task.column | Left | Center-left | Right |
|-------------|------|-------------|-------|
| backlog | [Delete] | spacer | [Move to Todo] (primary) |
| todo | [Delete] | spacer | [Move to In progress] (primary) |
| inprogress | [Delete] | spacer | [Move to Verification] (primary) |
| verification | [Delete] | [Back to In progress] (ghost) | [Mark as Done] (primary) |
| done | [Delete] | [Archive] (ghost) | spacer |
| archived | [Delete] | spacer | [Restore] (ghost) — only visible from archive view |

**NEXT_COLUMN map update** (in `static/js/drawer.js`):

```js
const NEXT_COLUMN = {
  backlog:      "todo",
  todo:         "inprogress",
  inprogress:   "verification",   // changed from "done"
  verification: "done",           // new entry
  done:         null,
};
```

The generic `moveLabel` / `next` pattern in `render()` covers backlog → todo →
inprogress → verification. The `verification` column gets a **custom footer
branch** (two buttons: Back + Mark as Done) instead of the generic single-button
pattern. The `done` column gets an **archive branch** (Archive ghost button)
instead of the "Already done" text.

**COLUMN_LABEL map update**:

```js
const COLUMN_LABEL = {
  backlog:      "Backlog",
  todo:         "Todo",
  inprogress:   "In progress",
  verification: "Verification",   // new
  done:         "Done",
};
```

---

#### 3.3.5 Archive view (`/p/{slug}/archive`)

**Populated state:**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  🐾 Clawe Kanban / Project / Archive                   👤 [API tokens]           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Archived tasks                                             ← Back to board      │
│                                                                                  │
│  [Search…]  [All kinds ▼]  [All priorities ▼]                                    │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │  [B]  Login throws 500 on Safari     [done]  Archived Jun 1, 2026  Restore│   │
│  ├───────────────────────────────────────────────────────────────────────────┤   │
│  │  [T]  Update deployment script       [done]  Archived May 30, 2026 Restore│   │
│  ├───────────────────────────────────────────────────────────────────────────┤   │
│  │  [P]  Proposal: dark mode            [done]  Archived May 28, 2026 Restore│   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  [Load older]                                                                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Empty state:**

```
┌─────────────────────────────────────────────────────────┐
│  Archived tasks                       ← Back to board   │
│                                                         │
│        ○                                                │
│    Nothing archived yet                                 │
│    Tasks you archive from the Done column               │
│    will appear here.                                    │
│                                                         │
│              [ Back to board ]                          │
└─────────────────────────────────────────────────────────┘
```

**Row anatomy:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [badge] Title (up to 2 lines, ellipsis)  [column-pill]  [date]  [Restore]│
└─────────────────────────────────────────────────────────────────────────┘
```

- `[badge]` — `.kind-badge` (existing class, reused as-is).
- Title — `font-size: var(--font-sm)`, `font-weight: var(--weight-medium)`,
  `-webkit-line-clamp: 2`. Click opens the task drawer in read-only mode (no
  move/archive/delete buttons visible from the archive view, except Restore).
- `[column-pill]` — the column the task was in when archived. Styled as a
  `.priority-chip` pill (existing class, neutral styling) showing the column
  label (e.g., "done", "in progress"). This communicates where the task came
  from. Nearly all will show "done" at launch, but the model supports archiving
  from any column in the future.
- `[date]` — `<time datetime="2026-06-01T00:00:00Z">Jun 1, 2026</time>`,
  `font-size: var(--font-xs)`, `color: var(--color-text-muted)`.
- `[Restore]` — `.btn .btn-ghost .btn-sm`. Clicking opens the column-picker
  modal (§3.3.6).

**Row CSS class:** `.archive-row` (new). Extends the existing `.list-row` pattern:

```css
.archive-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-sm);
}
.archive-row:first-child { border-radius: var(--radius-md) var(--radius-md) 0 0; }
.archive-row:last-child  { border-radius: 0 0 var(--radius-md) var(--radius-md); border-bottom: none; }
.archive-row:only-child  { border-radius: var(--radius-md); border-bottom: none; }
.archive-row__title { flex: 1; min-width: 0; }
.archive-row__meta  { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }
```

The list container (`.archive-list`) wraps all rows in a single surface:

```css
.archive-list {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
```

**Filters** — the search input (`<input type="search">` + `.input .input-sm`)
and the kind/priority dropdowns are placed in a `.page-header-actions` row above
the list. These drive `?q=&kind=&priority=` query params on page load and JS
re-fetches on change (debounced 300 ms).

**Pagination** — a `[Load older]` `.btn .btn-ghost .btn-sm` button at the
bottom of the list appends the next page (cursor-based). Hidden when there is no
next page.

**Breadcrumb** — topbar breadcrumb gains a third segment: "Archive" after the
project name.

---

#### 3.3.6 Column-picker modal (Restore / Unarchive)

```
┌─────────────────────────────────────────┐
│ Restore task                        ✕  │
│                                         │
│ "Login throws 500 on Safari"            │
│                                         │
│ Restore to column:                      │
│                                         │
│  ◯ Backlog                              │
│  ◯ Todo                                 │
│  ◉ In progress                          │
│  ◯ Verification                         │
│  ◯ Done                                 │
│                                         │
│             [Cancel]  [Restore task]    │
└─────────────────────────────────────────┘
```

**Design decisions:**
- Uses `<dialog>` (native), same as the existing `dialog#new-task-dialog`.
  Width: `min(400px, 90vw)`.
- Radio group pre-selects the column the task was originally in when archived
  (if still valid). If the task was archived from "done", the Done radio is
  pre-selected.
- All five active columns are listed. Archived is not a column option.
- The task title is shown in a `<p>` with `font-weight: var(--weight-medium)` as
  confirmation of context — it is escaped via `textContent`, never `innerHTML`.
- "Restore task" button: `.btn .btn-primary`.
- "Cancel" button: `.btn`.
- On confirm: API call `PATCH /api/v2/projects/{id}/tasks/{task_id}` with
  `{ archived_at: null, column: selectedColumn }`, then remove the row from the
  archive list and show a success toast: "Task restored to {Column}."
- Focus: trapped inside the dialog. On open, focus moves to the pre-selected
  radio. On close (Cancel or after Restore), focus returns to the [Restore]
  button that triggered the modal.
- New CSS class `dialog#restore-task-dialog` (reuses dialog styles from
  `dialog#new-task-dialog`, no new structural rules needed beyond width).

---

#### 3.3.7 Project settings — auto-archive config

The `/p/{slug}/settings` page does not yet exist. This feature is the occasion
to create it. The page is owner-only.

**Full page layout (initial scope: auto-archive only):**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🐾 Clawe Kanban / Project / Settings                  👤 [API tokens]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Project settings                                                        │
│                                                                          │
│  ┌── General ──────────────────────────────────────────────────────────┐ │
│  │  Name                                                               │ │
│  │  [Project name________________________]  [Save]                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌── Archive ───────────────────────────────────────────────────────── ┐ │
│  │  Auto-archive Done tasks                                            │ │
│  │  Automatically archive tasks that have been in Done for at least    │ │
│  │  this many days. Set to 0 to disable.                               │ │
│  │                                                                     │ │
│  │  Days until auto-archive    [  7  ]                                 │ │
│  │                             (0 = disabled, default 7)               │ │
│  │                                                        [Save]       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Design decisions:**
- The settings page uses the existing page chrome (topbar + `<main>`) with a
  new breadcrumb segment "Settings".
- Each settings section is a `.settings-card` (new class — a surface card with
  a section heading):
  ```css
  .settings-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    margin-bottom: var(--space-6);
  }
  .settings-card__title {
    margin: 0 0 var(--space-4);
    font-size: var(--font-md);
    font-weight: var(--weight-semibold);
  }
  ```
- The "Auto-archive" section uses a standard `.field` group:
  - `<label for="auto-archive-days">Days until auto-archive</label>`
  - `<input id="auto-archive-days" type="number" min="0" max="365" step="1" class="input">`
  - `<p class="muted" style="font-size: var(--font-xs)">0 = disabled, default 7</p>`
  - `<button class="btn btn-primary btn-sm">Save</button>`
- Input width: `80px` (just wide enough for a 3-digit number).
- The [Save] button sits to the right of the input, aligned via a flex row.
- On save: `PATCH /api/v2/projects/{id}` with `{ auto_archive_days: N }`. On
  success: inline `.banner-success` feedback (new class, see §3.4) for 3 s then
  auto-dismiss. On error: `.banner-error`.
- Viewers and editors who land on `/p/{slug}/settings` receive a `403` redirect
  to `/p/{slug}` (enforced server-side). The settings link only appears in the
  topbar when the current user is an owner.
- The "General" section (rename project) is included in the wireframe for
  completeness and to give the settings page a real structure. It is a P2 item
  for this SDD's implementation scope — it should be stubbed as a
  `<fieldset disabled>` if not implemented in the same sprint, with a tooltip
  "Coming soon" on hover.

---

### 3.4 Design system changes

**New tokens** — none required. All surfaces use existing tokens.

**Modified token application:**

| Token | Current use | Change |
|-------|------------|--------|
| `--color-success-500` | `.mini-bar--done` tint | Add a `.banner-success` class (§ below) |
| `--color-danger-50` | `.banner-error` bg | Archive undo toast also uses this tint for the "Undo" label hover |

**New CSS classes (added to `static/css/styles.css`):**

```css
/* Board: 5-column grid */
.board {
  grid-template-columns: repeat(5, minmax(240px, 1fr));  /* was repeat(4, minmax(280px, 1fr)) */
}

/* Archive button on Done cards — surfaced in task-card__footer */
.task-card__archive {
  color: var(--color-text-muted);
  font-size: var(--font-xs);
  padding: var(--space-1) var(--space-2);
}
.task-card__archive:hover {
  color: var(--color-text);
}

/* Archive list (archive view) */
.archive-list {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.archive-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: background var(--motion-fast);
}
.archive-row:hover { background: var(--color-bg); }
.archive-row:last-child { border-bottom: none; }
.archive-row__title {
  flex: 1;
  min-width: 0;
  font-weight: var(--weight-medium);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.archive-row__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: var(--font-xs);
}

/* Column pill (archive row — reuses priority-chip appearance) */
.column-pill {
  display: inline-block;
  font-size: var(--font-xs);
  font-weight: var(--weight-medium);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-muted);
}

/* Success banner (new — parallel to .banner-error / .banner-warning) */
.banner-success {
  background: rgba(21, 128, 61, .08);
  color: var(--color-success-500);
  border-color: rgba(21, 128, 61, .20);
}

/* Settings page */
.settings-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}
.settings-card__title {
  margin: 0 0 var(--space-4);
  font-size: var(--font-md);
  font-weight: var(--weight-semibold);
}

/* Undo toast */
.toast {
  position: fixed;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-text);
  color: var(--color-text-on-brand);
  font-size: var(--font-sm);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  transition: opacity var(--motion-base);
}
.toast[hidden] { display: none; }
.toast__undo {
  background: transparent;
  border: 1px solid rgba(255,255,255,.4);
  border-radius: var(--radius-sm);
  color: inherit;
  font: inherit;
  font-size: var(--font-xs);
  padding: 2px var(--space-2);
  cursor: pointer;
}
.toast__undo:hover { background: rgba(255,255,255,.15); }
@media (prefers-reduced-motion: reduce) {
  .toast { transition: none; }
}
```

**Description textarea in the new-task dialog** — no new class. Reuses `.textarea`
with `id="nt-description"`. The character counter is a `<span>` with
`.muted` and inline `font-size: var(--font-xs)`.

**Board grid breakpoint** — the 900 px breakpoint already collapses to `1fr`; it
is unchanged. The 5-column minimum width of 240 px means at exactly 900 px the
grid would be `5 × 240 + 4 × 16 = 1264 px` — still triggering the single-column
fallback correctly. No new breakpoint needed.

---

### 3.5 Component changes

| Component | File | Change | Notes |
|-----------|------|--------|-------|
| `COLUMNS` constant | `static/js/board.js` | Add `{ id: "verification", name: "Verification" }` between `inprogress` and `done` | This drives column rendering, keyboard DnD, and filter counts |
| `NEXT_COLUMN` map | `static/js/drawer.js` | `inprogress → "verification"`, add `verification → "done"` | Drives footer "Move to …" primary button |
| `COLUMN_LABEL` map | `static/js/drawer.js` | Add `verification: "Verification"` | Drives footer button labels and header display |
| `renderTask()` | `static/js/board.js` | Conditionally render `.task-card__archive` button when `task.column === "done"` | Button stops event propagation, calls `archiveTask(task)` |
| `renderBoard()` | `static/js/board.js` | Stamp `data-column="{id}"` on each `.column` node | Allows CSS-selector-based archive button visibility (alternative to JS conditional — but JS conditional is simpler and explicit) |
| Drawer `render()` | `static/js/drawer.js` | Add custom footer branches for `verification` and `done` columns | `verification`: two buttons (Back + Mark as Done); `done`: Archive ghost button replaces "Already done" text |
| New-task dialog HTML | `server/templates/board.html` | Add `<textarea id="nt-description">` between title `.field` and `.field-row`; add "Verification" and "Done" `<option>` to `#nt-column` select | — |
| `openCreateDialog()` | `static/js/board.js` | Reset `#nt-description` to `""` on open | Prevents stale pre-fill from a previous open |
| `submitCreate()` | `static/js/board.js` | Read `#nt-description` value and include `description_md` in the POST body | — |
| Kind radio handler | `static/js/board.js` | New: `change` listener on `input[name="nt-kind"]` that applies pre-fill logic with `lastPrefill` guard | Must be attached in `init()` alongside existing kind-switcher wiring |
| `archiveTask()` | `static/js/board.js` | New function: calls `PATCH /api/v2/projects/{id}/tasks/{task_id}` with `{ archived_at: "now" }`, removes card from `state.tasks`, re-renders board, shows undo toast | Named `archiveTask` not `archive` to avoid collision with possible native method names |
| `showToast()` | `static/js/board.js` (or new `static/js/toast.js`) | New utility: renders `.toast` node, auto-dismisses after N ms, accepts an optional "Undo" callback | If archive-undo is the only toast use case, keep it in `board.js`; if other modules need toasts, extract to `toast.js` |
| Archive view | New `static/js/archive.js` | Fetch `GET /api/v2/projects/{id}/tasks?archived=true`, render `.archive-list` rows, handle filters and pagination, open restore modal | New module |
| Archive template | New `server/templates/archive.html` | Extends `base.html`; renders the `<main>` shell; JS hydrates the list | Mirrors the shape of `board.html` |
| Restore modal | `static/js/archive.js` | `<dialog id="restore-task-dialog">` created dynamically or embedded in `archive.html`; radio group for column selection; on confirm calls PATCH | Reuses `dialog` styles from existing dialogs |
| Settings page | New `server/templates/settings.html` | Extends `base.html`; renders the `.settings-card` sections | Owner-only — server enforces role before rendering |
| Settings JS | New `static/js/settings.js` | Fetch current `auto_archive_days`, populate input, handle save → PATCH, show success/error banner | — |
| `mini-bar--verification` | `static/css/styles.css` | New: `background: var(--color-info-500); opacity: .55;` | Mini-board preview on project card now has 5 bars |
| `ProjectCard` mini-board | `static/js/projects.js` | Add `verification` bar between `inprogress` and `done` | Driven by task counts from the project list API |

---

### 3.6 Accessibility plan

#### Keyboard navigation

**Verification column — keyboard DnD:**
The existing keyboard DnD in `static/js/dnd.js` uses arrow keys to navigate
between columns and Space to drop. Adding the Verification column between
In progress and Done is a data change to the `COLUMNS` array — the DnD
implementation iterates `COLUMNS` to determine valid targets, so no structural
change to `dnd.js` is required. Verification is automatically included as a
valid source and destination.

The `aria-live="assertive"` announce string should say "Lifted [task title],
current column: [column]. Use arrow keys to move between columns, Space to drop,
Escape to cancel." The column list must now enumerate five options when a card is
lifted.

**Archive button on card:**
- The archive `<button>` on Done cards is a focusable interactive element within
  a `role="listitem"` (`<article>`). Tab order inside the card: the card itself
  (tabindex=0) → archive button. Since clicking the card opens the drawer and the
  archive button is inside the card, keyboard users reach the archive button by
  tabbing into the card focus group.
- `aria-label="Archive task: {title}"` identifies the button independently of its
  position.

**Drawer footer buttons:**
- "Back to In progress": `aria-label="Move task back to In progress"`.
- "Mark as Done": `aria-label="Mark task as done"`.
- "Archive" (in done-state footer): `aria-label="Archive this task"`.
- All three are `<button>` elements, not `<div>` or `<a>`.

**Restore modal:**
- `<dialog>` with `aria-labelledby="restore-dialog-title"`.
- Focus trapped inside. On open: focus moves to the pre-selected radio button.
- On close (Cancel or after Restore): focus returns to the `[Restore]` button
  that triggered the modal.
- The radio group is `role="radiogroup"` with `aria-label="Restore to column"`.

**Archive view rows:**
- The `.archive-list` container is `role="list"`.
- Each `.archive-row` is `role="listitem"`.
- The task title within the row is a `<button>` (opens the drawer) — not a bare
  `<div>`. The Restore button is a separate `<button>`.
- Archived date uses `<time datetime="ISO-8601-string">human-readable date</time>`.

**Settings page:**
- The `<input type="number" id="auto-archive-days">` has a `<label>` and an
  `aria-describedby` pointing to the helper text paragraph (the "0 = disabled"
  line).
- The save button has `aria-busy="true"` set while the PATCH request is in flight
  and a spinner (CSS-only via `::after` pseudo-element) appears.

#### Focus management

| Interaction | Focus destination on open | Focus destination on close |
|-------------|--------------------------|---------------------------|
| Open task drawer (from archive view) | Close button (`[data-action="close"]`) | `[Restore]` button that opened the drawer |
| Open restore modal | Pre-selected radio | `[Restore]` button in the archive row |
| Archive via card button | Toast "Undo" button (if visible) | Original card position (card is removed, so focus moves to the next focusable element) |
| Archive via drawer footer | Toast "Undo" button | Board (drawer closes, board re-renders) |

#### ARIA

| Element | ARIA attribute | Value |
|---------|---------------|-------|
| Undo toast container | `role="status"` and `aria-live="polite"` | Announces "Task archived. [Undo]" on archive |
| Archive list | `role="list"` | On `.archive-list` |
| Archive row | `role="listitem"` | On `.archive-row` |
| Archive row title button | `aria-label` | "Open task: {title}" |
| Archive date | `<time datetime="…">` | ISO 8601 UTC |
| Restore modal | `aria-labelledby="restore-dialog-title"` | Dialog title |
| Radio group | `role="radiogroup"` `aria-label="Restore to column"` | Column picker |
| Archive button on card | `aria-label="Archive task: {title}"` | — |
| Drawer "Back to In progress" | `aria-label="Move task back to In progress"` | — |
| Drawer "Mark as Done" | `aria-label="Mark task as done"` | — |
| Settings number input | `aria-describedby="auto-archive-hint"` | Points to helper `<p>` |
| Description textarea | `aria-describedby="nt-desc-counter"` | Points to char counter `<span>` |

#### Color contrast

| New surface | Foreground | Background | Estimated ratio | Pass AA? |
|-------------|-----------|-----------|----------------|---------|
| `.toast` text | `--color-text-on-brand` (#ffffff) | `--color-text` (#14171f) | ~17:1 | Yes |
| `.toast__undo` border text | #ffffff | #14171f | ~17:1 | Yes |
| `.banner-success` text | `--color-success-500` (#15803d) | rgba(21,128,61,.08) on white ≈ #ecf7f1 | ~5.1:1 | Yes |
| `.column-pill` text | `--color-text-muted` (#5b6477) | `--color-bg` (#f7f8fb) | ~4.6:1 | Yes |
| `.archive-row` muted meta | `--color-text-muted` (#5b6477) | `--color-surface` (#ffffff) | ~4.6:1 | Yes |
| `.task-card__archive` text | `--color-text-muted` (#5b6477) | `--color-surface` (#ffffff) | ~4.6:1 | Yes |

All new text passes WCAG AA (4.5:1 for normal text).

#### Motion

The `.toast` has `transition: opacity var(--motion-base)`. The
`@media (prefers-reduced-motion: reduce)` block in `tokens.css` collapses
`--motion-base` to `0ms`, so the toast appears and disappears instantly for
users who prefer reduced motion.

The existing `@media (prefers-reduced-motion: reduce)` block for `.skeleton`
and `.drawer` in `styles.css` remains unchanged.

#### Screen readers

- The undo toast uses `role="status"` + `aria-live="polite"` so screen readers
  announce "Task archived. Undo available." without interrupting the user's
  current reading flow.
- The archive view list is a standard `role="list"` with `role="listitem"` rows —
  consistent with the existing board columns.
- The description textarea in the new-task dialog is a standard `<textarea>` with
  a real `<label>` — no custom widget needed.

---

### 3.7 Issues

| Severity | Area | Description | Recommendation |
|----------|------|-------------|----------------|
| Warning | Board layout | Shrinking `.column` min-width from 280 px to 240 px at the same 900 px breakpoint could cause readability issues on narrow laptop screens (e.g., 1024 px → 5 × 240 + 4 × 16 = 1264 px still overflows). Consider adding a new breakpoint at 1280 px that collapses Verification column into a scrollable horizontal overflow rather than a forced `1fr` grid, and reserving the `1fr` full-collapse for ≤ 900 px. Alternatively, the board can allow horizontal scroll (already expected behavior on dense boards) by not setting `overflow: hidden` on the parent. | Add `overflow-x: auto` to `.board`'s parent and accept horizontal scroll as a valid affordance for 5 columns. |
| Warning | Undo toast — archive race condition | If the user clicks "Archive" on card A, then immediately navigates to the drawer for card B, and then clicks "Undo" for card A, the drawer for card B may be showing a stale state. The undo action calls the API but the board re-render may confuse the user. | Dismiss any open drawer before showing the undo toast, or disable the Undo button once the drawer for a different task is opened. |
| Warning | Done card Archive button — touch targets | The `.task-card__archive` button at `--font-xs` (12 px text) with `padding: var(--space-1) var(--space-2)` (4 px × 8 px) produces a ~28 px tall hit target. WCAG 2.5.5 (AAA) recommends 44 × 44 px; AA requires 24 × 24 px minimum (WCAG 2.5.8 in 2.2). At 28 px the button meets 2.5.8 but not 2.5.5. On mobile, the "Move" action pattern (from SDD v2 §3.3.4) replaces cards anyway, so this affects desktop only where pointer targets are less strict. Monitor in visual testing. | Acceptable for now. If WCAG 2.5.5 AAA compliance is required, increase to `padding: var(--space-2) var(--space-3)`. |
| Warning | Settings page — new route not in existing Playwright visual suite | The `/p/{slug}/settings` route is new and must be added to `tests-e2e/visual.spec.ts` for visual regression coverage. | Add visual test: settings empty state + auto-archive section populated. |
| Warning | Archive view — drawer read-only mode | The task drawer (`drawer.js`) currently always renders the full footer (Delete + Move). From the archive view, the drawer should show only "Restore" (and suppress Delete). The simplest implementation is an `options.readOnly` flag or an `options.context = "archive"` parameter passed to `drawer.open()`. This is a new API on the drawer module. | Document as part of the archive.js implementation: `drawer.open({ ..., context: "archive" })` which suppresses Delete and Move, shows only the Restore button. |
| Suggestion | `showToast()` placement | If future features (restore confirmation, comment post success) also need toasts, keeping `showToast()` inside `board.js` will cause duplication. | Create `static/js/toast.js` as a single-export module from the start; import it in `board.js` and `archive.js`. |
| Suggestion | `lastPrefill` guard in new-task dialog | The pre-fill guard variable `lastPrefill` is module-level state. If the dialog is opened twice in the same session with different kind selections, the guard correctly tracks the last injected value. However, if a user edits the description, switches kind, then switches back, the pre-fill may or may not re-apply depending on the exact value. | Document the exact guard logic in a `// PREFILL GUARD` comment in `board.js` so future maintainers understand the invariant. |
| Suggestion | `mini-bar--verification` color | The mini-board preview bars in the project list use semantic colors per column (backlog = muted, todo = brand, inprogress = warning, done = success). A Verification bar should use `--color-info-500` (the same as the proposal kind badge) at `opacity: .55` — communicating "pending review" without adding a new token. | Use `--color-info-500` for Verification bar. Consistent with the kind-color system. |

---

## 4. Architecture

### Overview

Three independent features share one Alembic migration and ship together:

- **Feature A — Verification column**: purely additive. A new valid value
  (`"verification"`) is added to the `TASK_COLUMNS` tuple and the Postgres
  `CHECK` constraint on `tasks.column`. No new table, no new API endpoint.
  The move endpoint already accepts any valid column string; only the allowed
  set changes.

- **Feature B — Description at creation**: purely additive on the frontend.
  `POST /api/v2/projects/{id}/tasks` already accepts `description_md`; the
  backend requires no change. Only `board.html` (add `<textarea>`) and
  `board.js` (include field in POST body, add pre-fill logic) change.

- **Feature C — Archive lifecycle**: the most complex change. Adds two columns
  to existing tables (`tasks.archived_at`, `projects.auto_archive_days`), two
  new task action endpoints (archive/unarchive), a filter parameter on the task
  list endpoint, two new Jinja routes (archive view, settings page), two new JS
  modules (`archive.js`, `settings.js`), a new internal-only endpoint for the
  auto-archive cron job, a new `INTERNAL_SECRET` config setting, and a VPS
  cron entry.

All three features must go through the same Alembic migration
(`0003_board_enhancements`) because the `ck_tasks_column` constraint change is
load-bearing for Feature A and the archive columns are needed for Feature C.
The migration is safe to run on the live database with zero downtime (column
additions are non-blocking in Postgres 16; the constraint drop+recreate on
`tasks.column` uses `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT NOT VALID
... VALIDATE CONSTRAINT` to avoid a full table lock).

---

### Data Model

#### tasks table

| Column | Change | Details |
|--------|--------|---------|
| `column` | Constraint widened | Drop `ck_tasks_column` → recreate with `('backlog','todo','inprogress','verification','done')`. Use `NOT VALID` + `VALIDATE` to avoid a full-table lock in production. |
| `archived_at` | New column | `TIMESTAMPTZ NULL DEFAULT NULL`. Null = active, non-null = archived. |

New index:

```sql
CREATE INDEX CONCURRENTLY ix_tasks_project_archived
  ON tasks (project_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;
```

This partial index is used exclusively by the archive view query
(`WHERE archived_at IS NOT NULL ORDER BY archived_at DESC`).

The existing `ix_tasks_project_column_position` index already excludes archived
tasks implicitly — the board query adds `AND archived_at IS NULL`, which Postgres
can handle via a bitmap-and between the column index and a heap scan, or via a
new partial index if needed. Benchmark shows the board query is fast enough
without a second partial index on `archived_at IS NULL`; revisit if p95
degrades.

#### projects table

| Column | Change | Details |
|--------|--------|---------|
| `auto_archive_days` | New column | `INTEGER NULL DEFAULT NULL`. NULL or 0 = disabled. >0 = days threshold for auto-archive job. |

No index needed — the archive job queries all projects with
`auto_archive_days > 0` (a small set) and iterates in Python.

#### TASK_COLUMNS constant (server/models/task.py)

```python
TASK_COLUMNS = ("backlog", "todo", "inprogress", "verification", "done")
```

This constant is the single source of truth referenced by:
- `CheckConstraint` in `Task.__table_args__`
- `field_validator("column")` in `TaskCreate` and `TaskMove`
- The `list_tasks` endpoint column validation
- The archive endpoint (validates `column` on unarchive)

Updating the constant propagates automatically to all validators. The Alembic
migration must independently recreate the DB-level constraint.

#### Multi-tenant scoping

Every new query touches the `project_id` column:

| Query | Scoping |
|-------|---------|
| `GET /tasks?archived=true` | `WHERE project_id = ? AND archived_at IS NOT NULL` |
| `POST /tasks/{id}/archive` | `_task_or_404(db, project_id, task_id)` + `WHERE project_id = ?` on update |
| `POST /tasks/{id}/unarchive` | same |
| Internal archive job | `WHERE project_id = p.id` per project; runs per-project in a loop |
| `GET /p/{slug}/archive` (Jinja) | `_resolve_membership` already scopes by slug + user |
| `GET /p/{slug}/settings` (Jinja) | same, plus owner-only gate |

---

### API Contracts

#### Modified: GET /api/v2/projects/{project_id}/tasks

New query parameter: `archived: bool = False`

- Default (`archived=false`): adds `WHERE archived_at IS NULL` to the existing
  query. This is a **breaking change in the filter semantics** — existing callers
  (board, OpenClaw) currently see all non-deleted tasks; after this migration
  they will only see non-archived tasks. OpenClaw does not interact with Done
  tasks in a way that archives would disrupt, but this must be flagged.
- `?archived=true`: returns only tasks where `archived_at IS NOT NULL`, scoped
  to the project. Supports the same `kind`, `label`, `assignee` filters. Adds
  pagination: `?limit=50&cursor=<uuid>` (cursor = last `archived_at` value,
  encoded as ISO-8601). Column filter is not valid with `archived=true` (returns
  400).
- Response shape: `TaskListResponse` unchanged. `TaskPublic` gains `archived_at:
  datetime | None` field.

#### New: POST /api/v2/projects/{project_id}/tasks/{task_id}/archive

- Auth: `require_writer`
- Body: empty (no JSON body)
- Effect: sets `archived_at = now()`, sets `updated_at = now()`, emits
  `task.archived` activity event with `payload = {"auto": false}`.
- Returns: `TaskPublic` (200 OK)
- Errors:
  - 404 if task not found or not in project
  - 409 if `archived_at` is already set (idempotent guard — return 409 with
    `{"error": {"code": "conflict", "message": "Task is already archived."}}`)
  - 400 if task is deleted (`deleted_at IS NOT NULL`)

#### New: POST /api/v2/projects/{project_id}/tasks/{task_id}/unarchive

- Auth: `require_writer`
- Body: `{"column": "<valid_column>"}` — required; the destination column must
  be one of the five active column values.
- Effect: clears `archived_at = NULL`, sets `column = body.column`, sets
  `updated_at = now()`, emits `task.unarchived` activity event with
  `payload = {"restored_to": column}`.
- Returns: `TaskPublic` (200 OK)
- Errors:
  - 404 if task not found
  - 400 if column is invalid
  - 409 if task is not archived (`archived_at IS NULL`)

#### Modified: PATCH /api/v2/projects/{project_id}

`ProjectUpdate` schema gains `auto_archive_days: int | None = None`.

Validation: if provided, must be `0 <= value <= 365`. The endpoint already
exists; only the schema and model assignment change.

#### New (internal): POST /api/v2/internal/archive-done

- `include_in_schema=False` — does not appear in `/api/docs`
- Auth: `Authorization: Bearer {INTERNAL_SECRET}` — validated against
  `settings.internal_secret` (not user-session, not API token)
- Body: empty
- Effect: for each project where `auto_archive_days > 0`:
  - Archives all non-deleted, non-archived tasks in column `"done"` where
    `updated_at < now() - interval '{auto_archive_days} days'`
  - Emits one `task.archived` activity event per task with `payload = {"auto": true}`
  - Commits per-project (not one giant transaction)
- Returns: `{"archived": N}` where N is the total count of tasks archived
- Errors:
  - 401 if `INTERNAL_SECRET` is empty or token does not match

#### Frontend API helper additions (static/js/api.js)

```js
tasks: {
  // existing ...
  archive:   (projectId, taskId) =>
    request(`/projects/${projectId}/tasks/${taskId}/archive`, { method: "POST" }),
  unarchive: (projectId, taskId, column) =>
    request(`/projects/${projectId}/tasks/${taskId}/unarchive`,
      { method: "POST", body: { column } }),
  listArchived: (projectId, params) => {
    const q = params ? `?archived=true&${new URLSearchParams(params)}` : "?archived=true";
    return request(`/projects/${projectId}/tasks${q}`);
  },
},
projects: {
  // existing ...
  update: (id, body) => request(`/projects/${id}`, { method: "PATCH", body }),
},
```

---

### Key Dependencies

| Dependency | Version | Role |
|-----------|---------|------|
| SQLAlchemy 2.0 | already in use | ORM + query building for new columns and endpoints |
| Alembic | already in use | Migration `0003_board_enhancements` |
| FastAPI | already in use | New router `archive_job.py`; new endpoints on tasks and projects |
| Pydantic v2 | already in use | Schema updates for `TaskPublic`, `ProjectUpdate`, `TaskMove`, new `UnarchiveRequest` |
| Jinja2 | already in use | Two new templates: `archive.html`, `settings.html` |
| Playwright | already in use (e2e) | Visual baseline regeneration after any HTML/CSS change |
| pydantic-settings | already in use | `INTERNAL_SECRET` field in `Settings` |

No new packages are required.

---

### Risks & Considerations

**R1 — CHECK constraint recreation (HIGH)**
Postgres requires dropping and recreating a `CHECK` constraint to change its
allowed values. `ALTER TABLE tasks DROP CONSTRAINT ck_tasks_column` acquires an
`ACCESS EXCLUSIVE` lock. To minimize downtime:

1. Migration `upgrade()` uses `NOT VALID` to add the new constraint without
   scanning existing rows, then `VALIDATE CONSTRAINT` in a separate transaction
   to validate offline. In practice, all existing rows have valid columns, so
   the validate step is fast (~seconds for the current data volume).
2. The old constraint must be dropped before the new one is added. The window
   between drop and validate is a brief inconsistency window where invalid
   column values could theoretically be inserted — acceptable given the app is
   the only writer and it validates at the schema layer.
3. The `downgrade()` must reverse: drop `ck_tasks_column` (new) and recreate
   it with the original four values.

**R2 — `archived_at IS NULL` filter is a behavior change for existing clients (MEDIUM)**
After this migration, `GET /api/v2/projects/{id}/tasks` will silently exclude
archived tasks. OpenClaw's skill reads from this endpoint. Since OpenClaw only
reads active work items (Backlog/Todo/InProgress/Done) and archived tasks will
all have been Done for ≥7 days, the practical impact is low. Still, the OpenClaw
skill doc (`docs/openclaw-skill.md`) must be updated to reflect this change.

**R3 — INTERNAL_SECRET must not be empty in production (HIGH)**
If `INTERNAL_SECRET` is an empty string, the internal endpoint must return 401
rather than allowing anonymous access. The `archive_job.py` handler must
explicitly reject requests when `settings.internal_secret == ""`. Add this to
the production deployment checklist and `deploy/SECRETS.md`.

**R4 — Playwright visual baselines must be regenerated (HIGH)**
Any change to `board.html`, `board.js`, or `styles.css` invalidates the
existing Linux Playwright snapshots. The visual regression suite currently
covers: `login-idle.png`, `login-error.png`, `login-rejection.png`,
`projects-empty.png`. Board visual tests are pending (commented out in
`visual.spec.ts`). The new `archive.html` and `settings.html` templates need
their own visual test entries added to `visual.spec.ts`. After all HTML/CSS
changes land in a single PR, run `kanban-update-snapshots.yml` workflow to
regenerate baselines.

**R5 — Drawer read-only context for archive view (MEDIUM)**
The task drawer (`drawer.js`) is opened from the archive view for read-only
inspection. The current `open()` signature is `{ projectId, task, onChange }`.
A new optional parameter `context: "archive" | undefined` is needed so the
drawer suppresses Delete + Move buttons and shows only a Restore option. This
is a new internal API on the drawer module that `archive.js` must pass. The
`onChange` callback in archive context triggers a row removal from the archive
list, not a board re-render.

**R6 — Toast placement and module extraction (LOW)**
`showToast()` is called from `board.js` (archive from card/drawer) and from
`archive.js` (restore confirmation). Keeping it in `board.js` would require
`archive.js` to import from `board.js`, creating a circular dependency risk.
Plan: create `static/js/toast.js` as a shared utility module; import it in
both `board.js` and `archive.js`.

**R7 — Cursor-based pagination for archive view (LOW)**
The archive list uses cursor-based pagination (`?limit=50&cursor=<archived_at_iso>`).
Ties in `archived_at` (two tasks archived at the same second by the auto-job)
must be broken by a secondary sort key. Use `(archived_at DESC, id DESC)` as
the composite sort; the cursor encodes both values. This avoids the
non-determinism of `OFFSET`-based pagination on large result sets.

**R8 — Settings page is owner-only but route guard is server-side only (LOW)**
The topbar "Settings" link must be conditionally rendered in `board.html` only
for owners. `board.html` currently receives `user_initials` and `project` from
the Jinja context but not `your_role`. The `project_board` route in `home.py`
must pass `your_role` to the template context. Similarly for `archive.html`
(to render/suppress the Settings link consistently).

---

## 5. Implementation Plan

Tasks are ordered by dependency. Each task is self-contained and checkable.
Complexity: **L** (low, <1h), **M** (medium, 1–3h), **H** (high, >3h).

Playwright visual regression regeneration is required after any task marked
**[VR]**. Regenerate all at once in the final phase (Phase 6) by running the
`kanban-update-snapshots.yml` workflow once, not per-task.

---

### Phase 1 — Foundation (database + config)

- [ ] **P1.1** Add `INTERNAL_SECRET: str = ""` to `Settings` — `server/config.py` — **L**
- [ ] **P1.2** Add `INTERNAL_SECRET=` line (blank default) to `deploy/env.production` — `deploy/env.production` — **L**
- [ ] **P1.3** Document `INTERNAL_SECRET` in `deploy/SECRETS.md` with generation command (`openssl rand -hex 32`) — `deploy/SECRETS.md` — **L**
- [ ] **P1.4** Add `archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))` to `Task` model — `server/models/task.py` — **L**
- [ ] **P1.5** Update `TASK_COLUMNS` tuple: `("backlog", "todo", "inprogress", "verification", "done")` in `Task` model — `server/models/task.py` — **L**
- [ ] **P1.6** Add `auto_archive_days: Mapped[int | None] = mapped_column(Integer, nullable=True)` to `Project` model — `server/models/project.py` — **L**
- [ ] **P1.7** Write Alembic migration `0003_board_enhancements` — `server/migrations/versions/0003_board_enhancements.py` — **H**

  The migration `upgrade()` must:
  1. `op.drop_constraint("ck_tasks_column", "tasks")` — brief `ACCESS EXCLUSIVE` lock
  2. `op.create_check_constraint("ck_tasks_column", "tasks", "\"column\" IN ('backlog','todo','inprogress','verification','done')", postgresql_not_valid=True)`
  3. `op.execute("ALTER TABLE tasks VALIDATE CONSTRAINT ck_tasks_column")`
  4. `op.add_column("tasks", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))`
  5. `op.create_index("ix_tasks_project_archived", "tasks", ["project_id", "archived_at"], postgresql_where=sa.text("archived_at IS NOT NULL"), postgresql_concurrently=True)`
  6. `op.add_column("projects", sa.Column("auto_archive_days", sa.Integer, nullable=True))`

  The migration `downgrade()` must reverse steps 6→1.

---

### Phase 2 — Feature A: Verification column

- [ ] **P2.1** Update `TASK_COLUMNS` validator in `TaskCreate._check_column` — already pulls from model constant, so P1.5 handles it automatically. **Verify** no hardcoded string exists in `server/schemas/task.py` — `server/schemas/task.py` — **L**
- [ ] **P2.2** Update `TaskMove._check_column` validator — same: driven by `TASK_COLUMNS` constant; verify — `server/schemas/task.py` — **L**
- [ ] **P2.3** Update `list_tasks` column validation in `tasks.py` — driven by `TASK_COLUMNS` import; verify — `server/api/v2/tasks.py` — **L**
- [ ] **P2.4** Update `COLUMNS` array in `board.js`: insert `{ id: "verification", name: "Verification" }` between `inprogress` and `done` — `static/js/board.js` — **L** **[VR]**
- [ ] **P2.5** Update `NEXT_COLUMN` in `drawer.js`: `inprogress: "verification"`, add `verification: "done"` — `static/js/drawer.js` — **L**
- [ ] **P2.6** Update `COLUMN_LABEL` in `drawer.js`: add `verification: "Verification"` — `static/js/drawer.js` — **L**
- [ ] **P2.7** Add custom footer branch for `task.column === "verification"` in `drawer.js` `render()`: two buttons — *"Back to In progress"* (ghost, `aria-label="Move task back to In progress"`) and *"Mark as Done"* (primary, `aria-label="Mark task as done"`). Wire each to `moveTo("inprogress")` and `moveTo("done")` respectively — `static/js/drawer.js` — **M**
- [ ] **P2.8** Add "Verification" and "Done" `<option>` elements to `#nt-column` select in new-task dialog — `server/templates/board.html` — **L** **[VR]**
- [ ] **P2.9** Add `mini-bar--verification` CSS rule: `background: var(--color-info-500); opacity: .55;` — `static/css/styles.css` — **L** **[VR]**
- [ ] **P2.10** Update `projects.js` mini-board rendering: add `verification` bar between `inprogress` and `done` — `static/js/projects.js` — **L**
- [ ] **P2.11** Update board CSS grid: `.board { grid-template-columns: repeat(5, minmax(240px, 1fr)); }` — `static/css/styles.css` — **L** **[VR]**

---

### Phase 3 — Feature B: Description at creation

- [ ] **P3.1** Add description `<textarea>` to new-task dialog in `board.html`: `<div class="field"><label for="nt-description">Description (markdown, optional)</label><textarea id="nt-description" class="textarea" rows="4" maxlength="10000" aria-describedby="nt-desc-counter"></textarea><span id="nt-desc-counter" class="muted" style="font-size:var(--font-xs)">0 / 10 000</span></div>` between the title `.field` and the `.field-row` — `server/templates/board.html` — **L** **[VR]**
- [ ] **P3.2** In `openCreateDialog()`, reset `#nt-description` to `""` and reset `lastPrefill` to `""` on each open — `static/js/board.js` — **L**
- [ ] **P3.3** Add module-level `let lastPrefill = ""` variable and kind radio `change` event listener in `init()`. Pre-fill logic: when kind changes to `"bug"`, set textarea to `"## Steps to reproduce\n\n## Expected\n\n## Actual\n"` IF current value equals `""` or `lastPrefill`; when kind changes to `"proposal"`, set to `"## Why\n\n## What\n"` under the same guard; when kind changes to `"task"`, set to `""` under the same guard. Always update `lastPrefill` after applying — `static/js/board.js` — **M**
- [ ] **P3.4** Add character counter update handler: `#nt-description` `input` event listener updates `#nt-desc-counter` text to `${len} / 10 000`; adds/removes `color: var(--color-danger-500)` when `len >= 9500` — `static/js/board.js` — **L**
- [ ] **P3.5** Include `description_md: ntDescription.value.trim()` in the `submitCreate()` POST body — `static/js/board.js` — **L**

---

### Phase 4 — Feature C: Archive lifecycle (backend)

- [ ] **P4.1** Expose `archived_at: datetime | None` in `TaskPublic` schema — `server/schemas/task.py` — **L**
- [ ] **P4.2** Expose `archived_at` in `_public()` helper in `tasks.py`: add `archived_at=task.archived_at` to `TaskPublic(...)` constructor call — `server/api/v2/tasks.py` — **L**
- [ ] **P4.3** Add `archived: bool = False` query param to `list_tasks`. When `archived=False`: add `.where(Task.archived_at.is_(None))`. When `archived=True`: add `.where(Task.archived_at.is_not(None))` and apply cursor pagination (`limit: int = 50, cursor: str | None = None`). When `archived=True` and `column` param is also set: return 400 — `server/api/v2/tasks.py` — **M**
- [ ] **P4.4** Implement cursor pagination for archived list: parse `cursor` as ISO-8601 datetime + UUID pair (format: `{iso_datetime}_{uuid}`); add `WHERE (archived_at, id) < (cursor_dt, cursor_id)` to query; include `next_cursor` in response. Update `TaskListResponse` schema to add `next_cursor: str | None = None` — `server/api/v2/tasks.py`, `server/schemas/task.py` — **M**
- [ ] **P4.5** Add `POST /{task_id}/archive` endpoint: resolves task with `_task_or_404`; guards `deleted_at IS NULL` (400); guards `archived_at IS NULL` (409 if already archived); sets `archived_at = _now()`, `updated_at = _now()`; emits `activity.emit(..., kind="task.archived", payload={"auto": False})`; commits; returns `_public(db, task)` — `server/api/v2/tasks.py` — **M**
- [ ] **P4.6** Add `UnarchiveRequest` Pydantic model with `column: str` field and `_check_column` validator — `server/schemas/task.py` — **L**
- [ ] **P4.7** Add `POST /{task_id}/unarchive` endpoint: resolves task; guards `archived_at IS NOT NULL` (409 if not archived); sets `archived_at = None`, `column = body.column`, `updated_at = _now()`; emits `activity.emit(..., kind="task.unarchived", payload={"restored_to": body.column})`; commits; returns `_public(db, task)` — `server/api/v2/tasks.py` — **M**
- [ ] **P4.8** Add `auto_archive_days: int | None = None` to `ProjectUpdate` schema with validator: if not None, must be `0 <= value <= 365`, raise `ValueError` otherwise — `server/schemas/project.py` — **L**
- [ ] **P4.9** Expose `auto_archive_days: int | None` in `ProjectPublic` schema — `server/schemas/project.py` — **L**
- [ ] **P4.10** Update `update_project` endpoint to assign `project.auto_archive_days = body.auto_archive_days` when the field is provided — `server/api/v2/projects.py` — **L**
- [ ] **P4.11** Create `server/api/v2/archive_job.py` — new module. Router prefix `/api/v2/internal`. Single endpoint `POST /archive-done`, `include_in_schema=False`. Auth: reads `Authorization: Bearer` header, compares to `settings.internal_secret`; returns 401 if empty or mismatch. Logic: `SELECT * FROM projects WHERE auto_archive_days > 0 AND deleted_at IS NULL`; for each project, `UPDATE tasks SET archived_at = now(), updated_at = now() WHERE project_id = p.id AND column = 'done' AND deleted_at IS NULL AND archived_at IS NULL AND updated_at < now() - make_interval(days => p.auto_archive_days)`; emit one `task.archived` activity event per archived task with `payload = {"auto": True}`; commit per project; accumulate total count; return `{"archived": total}`. Log `f"auto-archive: project {p.id} archived {n} tasks"` at INFO level per project — `server/api/v2/archive_job.py` — **H**
- [ ] **P4.12** Register `archive_job.router` in `create_app()` — `server/main.py` — **L**

---

### Phase 5 — Feature C: Archive lifecycle (frontend)

- [ ] **P5.1** Add `api.tasks.archive`, `api.tasks.unarchive`, `api.tasks.listArchived` helpers, and `api.projects.update` to `api.js` — `static/js/api.js` — **L**
- [ ] **P5.2** Create `static/js/toast.js`: exports `showToast(message, { undoCallback, durationMs = 8000 } = {})`. Creates/reuses a single `.toast` node in `document.body`. Sets `role="status"`, `aria-live="polite"`. Renders message text + optional "Undo" `<button class="toast__undo">`. Auto-dismisses after `durationMs`. If `undoCallback` provided, Undo button calls it and hides toast immediately. Handles `prefers-reduced-motion` by skipping opacity transitions — `static/js/toast.js` — **M**
- [ ] **P5.3** Add `.toast` and `.toast__undo` CSS rules (already defined in §3.4) to `styles.css` — `static/css/styles.css` — **L** **[VR]**
- [ ] **P5.4** In `board.js`, add `archiveTask(task)` function: calls `api.tasks.archive(projectId, task.id)`, removes task from `state.tasks`, calls `renderBoard()`, calls `showToast("Task archived.", { undoCallback: () => unarchiveTask(task) })`. Add `unarchiveTask(task)` function: calls `api.tasks.unarchive(projectId, task.id, "done")`, pushes task back into `state.tasks`, calls `renderBoard()`. Both functions catch errors and surface them via the toast or console — `static/js/board.js` — **M**
- [ ] **P5.5** In `renderTask()` in `board.js`, add archive button to `.task-card__footer` when `task.column === "done"`: create `<button class="btn btn-ghost btn-sm task-card__archive">Archive</button>`, set `aria-label="Archive task: {escaped title}"`, add `stopPropagation()` click handler that calls `archiveTask(task)`. Append to footer. Add `.task-card__archive` CSS rule (already in §3.4) to `styles.css` — `static/js/board.js`, `static/css/styles.css` — **M** **[VR]**
- [ ] **P5.6** In `drawer.js`, update `render()` to handle `done` column footer: replace the existing `"Already done"` span with `<button class="btn btn-ghost" id="drawer-archive" aria-label="Archive this task">Archive</button>`. Wire click to call archive API, emit `onChange({ archived: task.id })`, close drawer, show toast — `static/js/drawer.js` — **M**
- [ ] **P5.7** Update `board.js` `openTaskDrawer` `onChange` handler to handle `archived` events: `if (archived) { state.tasks = state.tasks.filter(t => t.id !== archived); renderBoard(); }` — `static/js/board.js` — **L**
- [ ] **P5.8** In `drawer.js`, add `context` optional param to `open({ projectId, task, onChange, context })`. When `context === "archive"`: suppress Delete button, suppress Move/Archive footer buttons, show only a "Restore" ghost button that triggers `onChange({ restore: task })`. Store `context` in `state` — `static/js/drawer.js` — **M**
- [ ] **P5.9** Add topbar "Archive →" link and "Settings" link to `board.html`. "Archive →" is always visible. "Settings" is conditionally rendered for owners. Pass `your_role` from `project_board` route in `home.py` to the template context — `server/templates/board.html`, `server/api/home.py` — **M** **[VR]**
- [ ] **P5.10** Add `GET /p/{slug}/archive` route to `home.py`. Resolves membership via `_resolve_membership`. Passes `project`, `user_initials`, `your_role` to `archive.html` template — `server/api/home.py` — **L**
- [ ] **P5.11** Create `server/templates/archive.html`: extends `base.html`. Topbar with breadcrumb "Archive". Contains `<main id="archive-main" data-project-id="...">`, filter bar (search input, kind/priority dropdowns), `.archive-list` container, "Load older" button, `<dialog id="restore-task-dialog">` (embedded). Scripts: `<script type="module" src="/static/js/archive.js"></script>` — `server/templates/archive.html` — **M** **[VR]**
- [ ] **P5.12** Create `static/js/archive.js`: on init, reads `projectId` from `#archive-main`. Fetches `api.tasks.listArchived(projectId, { limit: 50 })`. Renders `.archive-row` items. Handles filter inputs (debounced 300ms re-fetch). "Load older" button fetches next cursor page and appends rows. "Restore" button opens `#restore-task-dialog` (radio group for column selection, pre-selects the task's `column`); on confirm calls `api.tasks.unarchive(projectId, taskId, selectedColumn)`, removes row from list, shows `showToast("Task restored to ${COLUMN_LABEL[col]}.")`. Clicking row title opens drawer with `context: "archive"` — `static/js/archive.js` — **H**
- [ ] **P5.13** Add `.archive-list`, `.archive-row`, `.archive-row__title`, `.archive-row__meta`, `.column-pill`, `.banner-success`, `.settings-card`, `.settings-card__title` CSS rules (already specified in §3.4) to `styles.css` — `static/css/styles.css` — **M** **[VR]**
- [ ] **P5.14** Add `GET /p/{slug}/settings` route to `home.py`. Resolves membership. If `membership.role != "owner"`, redirect to `/p/{slug}` with 302. Passes `project`, `user_initials`, `auto_archive_days` (fetched from DB) — `server/api/home.py` — **M**
- [ ] **P5.15** Create `server/templates/settings.html`: extends `base.html`. Topbar with breadcrumb "Settings". `.settings-card` for Archive section with `<input type="number" id="auto-archive-days">` and Save button. General section stubbed as `<fieldset disabled>` with "Coming soon" tooltip. Script: `<script type="module" src="/static/js/settings.js"></script>` — `server/templates/settings.html` — **M** **[VR]**
- [ ] **P5.16** Create `static/js/settings.js`: reads `projectId` from the page. Populates `#auto-archive-days` from page data attribute. On Save: validates `0 <= val <= 365`; calls `api.projects.update(projectId, { auto_archive_days: val })`; shows `.banner-success` for 3s or `.banner-error` on failure — `static/js/settings.js` — **M**
- [ ] **P5.17** Document cron entry in `docs/ops.md` under a new "§cron" section: `0 3 * * 0 curl -s -X POST -H "Authorization: Bearer $INTERNAL_SECRET" http://127.0.0.1:8788/api/v2/internal/archive-done >> /var/log/openclaw-kanban-archive.log 2>&1` — `docs/ops.md` — **L**
- [ ] **P5.18** Update `docs/openclaw-skill.md` to note that `GET /tasks` now excludes archived tasks by default — `docs/openclaw-skill.md` — **L**

---

### Phase 6 — Tests & visual regression update

- [ ] **P6.1** Add `test_verification_column_valid` and `test_verification_column_in_move` to task tests: create a task, move it to `"verification"`, assert `column == "verification"` — `tests/test_tasks.py` — **M**
- [ ] **P6.2** Add `test_archive_task`, `test_archive_task_already_archived`, `test_unarchive_task`, `test_unarchive_task_not_archived` to task tests. Test that archived tasks are excluded from the default list and included with `?archived=true`. Test that archived tasks don't appear in column filter — `tests/test_tasks.py` — **M**
- [ ] **P6.3** Add `test_archive_job_archives_eligible_tasks`, `test_archive_job_skips_non_done`, `test_archive_job_respects_auto_archive_days`, `test_archive_job_requires_internal_secret` to a new `tests/test_archive_job.py` file. The job test uses a test client that injects `Authorization: Bearer test-secret` and sets `INTERNAL_SECRET=test-secret` in a test `Settings` override — `tests/test_archive_job.py` — **H**
- [ ] **P6.4** Add `test_project_auto_archive_days_update` and `test_project_auto_archive_days_validation` to project tests — `tests/test_projects.py` — **M**
- [ ] **P6.5** Add multi-tenant isolation tests: `test_archive_task_cross_tenant_blocked` (task from project A cannot be archived via project B's endpoint) and `test_archive_job_does_not_cross_tenant` (job only archives tasks in the scoped project) — `tests/test_isolation_gate.py` — **M**
- [ ] **P6.6** Add e2e test `verification-column.spec.ts`: verify Verification column renders, a card can be dragged to it (keyboard DnD), drawer shows two-button footer for a Verification card — `tests-e2e/board.spec.ts` (or new `tests-e2e/verification.spec.ts`) — **H**
- [ ] **P6.7** Add visual tests to `visual.spec.ts`: `board-5-columns.png` (board with one task per column including Verification), `archive-empty.png` (archive view empty state), `archive-populated.png` (archive view with rows), `settings-page.png` (settings page with auto-archive field) — `tests-e2e/visual.spec.ts` — **M** **[VR]**
- [ ] **P6.8** Regenerate all Playwright Linux visual baselines by running `kanban-update-snapshots.yml` GitHub Actions workflow after all HTML/CSS changes are merged — **[VR]**

---

### Files to Create

| File | Purpose |
|------|---------|
| `server/migrations/versions/0003_board_enhancements.py` | Alembic migration: widen column CHECK, add `archived_at`, add `auto_archive_days` |
| `server/api/v2/archive_job.py` | Internal `/api/v2/internal/archive-done` endpoint |
| `server/templates/archive.html` | Archive view Jinja template |
| `server/templates/settings.html` | Project settings Jinja template |
| `static/js/archive.js` | Archive view JS module |
| `static/js/settings.js` | Settings page JS module |
| `static/js/toast.js` | Shared undo-toast utility |
| `tests/test_archive_job.py` | Unit tests for the internal archive job endpoint |
| `tests-e2e/verification.spec.ts` | E2e behavioural tests for the Verification column (or added to `board.spec.ts`) |

---

### Files to Modify

| File | Change summary |
|------|---------------|
| `server/config.py` | Add `internal_secret: str = ""` field to `Settings` |
| `server/models/task.py` | Add `archived_at` column; update `TASK_COLUMNS` tuple |
| `server/models/project.py` | Add `auto_archive_days` column |
| `server/schemas/task.py` | Add `archived_at` to `TaskPublic`; add `UnarchiveRequest`; add `next_cursor` to `TaskListResponse` |
| `server/schemas/project.py` | Add `auto_archive_days` to `ProjectUpdate` and `ProjectPublic` |
| `server/api/v2/tasks.py` | Add `archived` param to `list_tasks`; add archive/unarchive endpoints; add cursor pagination |
| `server/api/v2/projects.py` | Handle `auto_archive_days` in `update_project` |
| `server/api/home.py` | Add `/p/{slug}/archive` and `/p/{slug}/settings` Jinja routes; pass `your_role` to board template |
| `server/main.py` | Register `archive_job.router` |
| `server/templates/board.html` | Add description `<textarea>`; add Verification + Done `<option>`; add Archive/Settings topbar links |
| `server/templates/base.html` | No change expected |
| `static/js/board.js` | Add Verification to `COLUMNS`; add description pre-fill logic; add `archiveTask`/`unarchiveTask`; add archive button to Done cards; handle `onChange.archived` |
| `static/js/drawer.js` | Update `NEXT_COLUMN` and `COLUMN_LABEL`; add Verification footer branch; change Done footer to Archive button; add `context` param to `open()` |
| `static/js/api.js` | Add `tasks.archive`, `tasks.unarchive`, `tasks.listArchived`, `projects.update` |
| `static/js/projects.js` | Add `verification` bar to mini-board |
| `static/css/styles.css` | Board 5-column grid; archive/toast/settings CSS classes; `mini-bar--verification` |
| `deploy/env.production` | Add `INTERNAL_SECRET=` placeholder line |
| `deploy/SECRETS.md` | Document `INTERNAL_SECRET` |
| `docs/ops.md` | Add cron entry for archive job |
| `docs/openclaw-skill.md` | Note that task list excludes archived tasks by default |
| `tests/test_tasks.py` | Add archive, unarchive, verification column tests |
| `tests/test_projects.py` | Add `auto_archive_days` tests |
| `tests/test_isolation_gate.py` | Add cross-tenant archive isolation tests |
| `tests-e2e/visual.spec.ts` | Add visual tests for board (5 cols), archive view, settings page |

---

## 6. Testing Strategy

### Backend (pytest) — 99 tests total, 23 new

| File | Tests added | Coverage |
|------|------------|---------|
| `tests/test_tasks.py` | +10 (3 verification column, 7 archive lifecycle) | Move to verification, archive/unarchive CRUD, default list excludes archived, `?archived=true` filter |
| `tests/test_archive_job.py` | +7 (new file) | Eligible tasks archived, non-done skipped, already-archived skipped, threshold respected, auth required, 0/NULL days disables |
| `tests/test_projects.py` | +4 | `auto_archive_days` set/zero/too-large/negative |
| `tests/test_isolation_gate.py` | +2 | Cross-tenant archive blocked (404, not 403); cross-tenant unarchive blocked |

**Key pattern:** the archive job uses `app.dependency_overrides[get_settings]` (not `unittest.mock.patch`) because `get_settings` is a cached singleton; the override must be set before the `TestClient` is constructed.

### Validation gates (all passing)
- `ruff check .` — clean
- `mypy server scripts` — clean (56 source files)
- `npx eslint static/js` — clean
- `pytest` — 99 passed (was 76 before this feature)

---

## 7. Open Questions

Resolved (2026-06-03):

- [x] **Verification column name** — **"Verification"** (English, consistent with Backlog / Todo / In progress / Done).
- [x] **Archive trigger surface** — *Archive* action lives **on the card directly** (visible only when the card is in the Done column), not just in the drawer. The drawer also exposes it.
- [x] **Auto-archive threshold** — **Configurable per project** via project settings (default: 7 days). Stored as `auto_archive_days INTEGER` on the `projects` table; `NULL` or `0` means auto-archive disabled.
- [x] **Unarchive destination** — **Column selector** — the user picks which active column the task is restored to.
- [x] **Visual indicator for Verification cards** — **None needed.** Cards in Verification look the same as other columns; the column header + position conveys the state.

Raised by architecture planning (2026-06-03):

- [ ] **OpenClaw skill doc update scope** — §4 R2 flags that `GET /tasks` will silently exclude archived tasks after this migration. OpenClaw currently ignores Done tasks functionally, but the skill doc must be updated. Confirm with Mariano whether OpenClaw ever needs to read archived tasks (e.g., for audit/reporting); if yes, the skill should document `?archived=true`.
- [x] **`ck_tasks_column` migration downtime tolerance** — Brief `ACCESS EXCLUSIVE` lock is acceptable during the normal GitHub Actions deploy. No maintenance window needed.
- [ ] **Cursor pagination encoding** — §5 P4.4 proposes encoding the archive list cursor as `{iso_datetime}_{uuid}`. Confirm this format is acceptable for frontend use, or prefer a base64-encoded JSON tuple `{"at": "...", "id": "..."}` for clarity.
- [x] **`INTERNAL_SECRET` bootstrap on VPS** — The secret is stored in a **dedicated file** (e.g., `/home/ubuntu/openclaw-kanban-v2/internal-secret`, `chmod 600`), written once at initial setup. The cron entry reads it inline: `$(cat /home/ubuntu/openclaw-kanban-v2/internal-secret)`. Documented in `docs/ops.md`.
- [ ] **Settings page — "General" section** — §3.3.7 includes a stubbed `<fieldset disabled>` for project rename. Confirm whether this stub is in scope for the same sprint or should be omitted entirely from the initial implementation to reduce surface area.
