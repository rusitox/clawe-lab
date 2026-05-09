# SDD: Kanban v2 — Multi-tenant redesign

**Status:** Approved
**Last updated:** 2026-04-25

---

## 1. Overview

### Problem

The current Kanban (`v1`) is a single-tenant prototype: one shared `KANBAN_TOKEN`,
one set of JSON files (`tasks.json`, `activity.json`, `teams.json`), one implicit
"project". This is fine as a personal board for OpenClaw work, but it falls down
the moment we want to:

- Track work for **more than one project** in parallel without manually swapping data files.
- Let **other users** (collaborators, external testers, OpenClaw operators) sign in
  with their own identity and see only what they should see.
- Capture richer task content — **bug reports**, **improvement proposals**, and
  **image attachments** (screenshots, mockups) — not just plain titles and descriptions.
- Use the dashboard as a **structured input feed** for downstream projects: Clawe and
  OpenClaw need to consume tickets, proposals, and bugs from a stable API rather than
  scraping JSON blobs.

The product needs to grow from "my personal board" into "a small multi-tenant ticket
system focused on Kanban UX, with first-class support for OpenClaw automation."

### Goals

- **Multi-project**: a single deployment hosts N projects; each project has its own
  board, columns, teams, members, and activity feed.
- **Multi-user**: every action is attributed to a user; access to a project is
  controlled by membership; cross-tenant reads/writes are impossible by construction.
- **Database-backed persistence**: schema-versioned, transactional storage replaces
  the JSON files; v1 data migrates cleanly into a single default project.
- **Rich task model**: tasks carry a `kind` (task / bug / proposal), free-form
  description (markdown), priority, assignees, labels, and attachments (image/file).
- **Stable API for OpenClaw**: a documented `/api/v2/*` surface that Clawe / OpenClaw
  can read and write programmatically with a per-user token.
- **No regressions on UX**: the Kanban board must remain as fast and direct as v1 —
  drag & drop, keyboard nav, and the activity feed all keep working.
- **Operable**: deploy stays a single systemd unit with a documented migration path;
  no new infrastructure required for self-hosting.

#### Measurable success criteria

- A user can sign in, create a project, invite a second user, create a task with
  an image attachment and a proposal, drag it across columns, and see all of it
  reflected for the second user — end-to-end.
- 100 % of API endpoints have a passing multi-tenant isolation test (a user from
  project A cannot read or mutate any object belonging to project B).
- v1 data import script runs against the existing `tasks.json`/`activity.json`/`teams.json`
  and produces an identical board in v2 under a default project.
- Median API latency p50 ≤ 100 ms, p95 ≤ 300 ms on a board with 200 tasks.
- Test coverage ≥ 80 % overall, ≥ 95 % on auth, multi-tenant scoping, and persistence.

### Out of scope

- Real-time collaborative editing (operational transform / CRDTs). Polling-based
  refresh is acceptable for v2; live updates are a v3 concern.
- Mobile-native apps. The web UI must be responsive on tablet and phone, but no
  iOS/Android client.
- Rich-text WYSIWYG editor. Markdown source + preview is enough for v2.
- Public read-only project sharing (anonymous links). Optional v3.
- Time tracking, sprint/burndown reports, gantt views, calendar views.
- Email notifications. The activity feed is the only notification surface in v2.
- Any AI / LLM integration on the dashboard itself (Clawe consumes the API instead).
- Self-serve billing / paid tiers.

---

## 2. Requirements

### Functional requirements

| Priority | Capability | User story | Acceptance criteria |
|----------|-----------|------------|---------------------|
| **P0** | **Auth — Google sign-in** | As a user, I want to sign in with my Gmail account so the system knows who I am. | Google OAuth 2.0 (`openid email profile`) is the only human sign-in path; first-time sign-in provisions a user record keyed by Google `sub`; subsequent sign-ins resolve to the same user; sign-out invalidates the session. |
| **P0** | **Auth — allow-list (optional)** | As an operator, I want to control who can sign in. | An optional `ALLOWED_EMAILS` / `ALLOWED_DOMAINS` env config rejects sign-ins outside the list; when unset, sign-in is open and new users land with no project memberships. |
| **P0** | **Auth — API token** | As an OpenClaw operator, I want a personal API token so my automation can call the API on my behalf. | A signed-in user can create / revoke long-lived tokens; tokens are hashed at rest (argon2id); the plaintext is shown only once at creation; revocation is immediate; tokens carry the user's identity, not a separate role. |
| **P0** | **Project — create** | As a user, I want to create a project so I can track work for it. | I can create a project with a name; I become its owner; I land on its empty board. |
| **P0** | **Project — list** | As a user, I want to see all projects I belong to. | `GET /api/v2/projects` returns only projects where I'm a member; results never include another user's projects. |
| **P0** | **Project — membership** | As an owner, I want to invite users to my project with a role. | I can add a user with role `owner`/`editor`/`viewer`; role enforces capabilities (viewer cannot mutate); removing a member is immediate. |
| **P0** | **Tasks — CRUD scoped to project** | As a member, I want to create, read, update, and delete tasks in my project. | All task endpoints take/return `project_id`; a request from a non-member returns 404 (not 403, no leak); deletion is soft (`deleted_at`) for tasks with history. |
| **P0** | **Tasks — kanban move** | As a member, I want to drag a task to another column or position. | Move endpoint updates `column` and `position` atomically; concurrent moves do not corrupt order; the activity feed records who moved what, when, from where, to where. |
| **P0** | **Tasks — kinds** | As a member, I want to mark a task as a generic task, a bug, or an improvement proposal. | `task.kind ∈ {task, bug, proposal}`; UI distinguishes the three visually; kind is filterable. |
| **P0** | **Tasks — rich description** | As a member, I want to write a task description in markdown. | Description is stored as raw markdown; **the server renders sanitized HTML** with a Python pipeline (e.g., `markdown-it-py` + `bleach`) and the API returns both the raw markdown and the safe HTML. The frontend never parses markdown — it inserts the server-sanitized HTML. |
| **P0** | **Attachments — image upload** | As a member, I want to attach images (screenshots, mockups) to a task. | I can upload PNG/JPEG/WebP up to a configurable size limit; files are stored outside the static dir; the DB only holds metadata; I can view and delete attachments. |
| **P0** | **Attachments — multi-tenant safety** | The system must never expose an attachment to a user outside the project. | Direct fetches by `attachment_id` are 404 unless the requester is a member of the owning project. |
| **P0** | **Activity feed — per project** | As a member, I want to see what changed in my project. | `GET /api/v2/projects/:id/activity` returns paginated events scoped to the project; older events are still queryable; activity from other projects is invisible. |
| **P0** | **Teams — per project** | As an owner, I want to define teams within a project (with colors). | Teams replace v1 `teams.json`; teams are scoped to a project; team color drives card chrome via design tokens. |
| **P0** | **OpenClaw — API consumption** | As OpenClaw, I want to read tasks/bugs/proposals to drive downstream automation. | `GET /api/v2/projects/:id/tasks?kind=...&since=...` is documented, paginated, and stable; output schema is versioned. |
| **P0** | **v1 → v2 migration** | As a current user, I want my existing data to come along. | `scripts/import_v1.py` reads `tasks.json`/`activity.json`/`teams.json` and produces a single project named **`Clawe HQ`** with all tasks, activity events, and teams intact. The script is idempotent (re-runs do not duplicate data) and attributes events to a `system` user when the original actor is unknown. |
| **P0** | **API versioning — soft cut** | As an OpenClaw operator, I want my existing scripts to keep working while I migrate. | v1 endpoints (`/api/tasks`, `/api/activity`, `/api/teams`, `KANBAN_TOKEN` shared auth) remain online during the transition window and respond against the imported `Clawe HQ` project. v2 (`/api/v2/*`, OAuth + per-user tokens) ships in parallel. v1 is removed only after the OpenClaw integration has been migrated. v1 returns a `Deprecation` and `Sunset` header for the duration. |
| **P0** | **Ownership transfer — block last owner removal** | As an owner, I cannot accidentally orphan a project. | Removing the last `owner` (whether self-removal or being removed) is rejected with a clear error: "transfer ownership first." The owner must explicitly promote another member to `owner` before stepping down. |
| **P1** | **Tasks — labels** | As a member, I want to label tasks with arbitrary tags. | Labels are scoped per project; `GET ?label=...` filters the board. |
| **P1** | **Tasks — assignees** | As a member, I want to assign tasks to myself or other members. | Assignees ⊆ project members; the board can filter by assignee; activity logs assign/unassign. |
| **P1** | **Comments** | As a member, I want to comment on a task. | Comments are markdown, attributed, and listed chronologically; deletion is soft. |
| **P1** | **Search** | As a member, I want to search tasks within a project. | Full-text search over title/description/comments; scoped to project; sub-second on 1k tasks. |
| **P1** | **Audit trail visibility** | As an owner, I want to see who did what at the project level. | The activity feed includes membership and project-config changes, not just task changes. |
| **P2** | **Themes / dark mode** | As a user, I want a dark mode toggle. | Honors `prefers-color-scheme`; manual override persists in `localStorage`. |
| **P2** | **Keyboard shortcuts** | As a power user, I want shortcuts for common actions. | Documented shortcut sheet; shortcuts respect focus and don't trap users in inputs. |
| **P2** | **Custom columns** | As an owner, I want to rename or reorder kanban columns per project. | Columns are stored per project; defaults seeded on create; UI allows owner-only edits. |

### Non-functional requirements

- **Performance**:
  - p50 ≤ 100 ms, p95 ≤ 300 ms for board reads and task mutations on a project with 200 tasks.
  - Activity feed pagination returns the latest 50 events in ≤ 200 ms p95.
  - Board first paint ≤ 1.5 s on a cold load over a 4G-equivalent connection.
- **Live updates**:
  - **Polling-based refresh** every 5–10 s for the activity feed and board state.
  - Polling cadence is configurable (`POLL_INTERVAL_MS`) with a hard floor to protect the server.
  - SSE / WebSocket realtime is explicitly out of scope for v2.0.
- **Security**:
  - All write endpoints require an authenticated user.
  - Per-user API tokens are hashed at rest (e.g., `argon2id` or `sha256` with salt) and only shown once on creation.
  - All SQL is parameterized; no string formatting with user input.
  - Multi-tenant isolation is enforced at the DB layer (every query filters by `project_id`) AND verified by an integration test on every endpoint.
  - Uploads validate MIME and size; files are stored outside the served static directory.
  - Markdown rendering uses a sanitizing pipeline (no `<script>`, no `javascript:` URLs, no inline event handlers).
  - Secrets (`KANBAN_TOKEN` legacy, DB URL, S3 keys if used) come from env vars or a sealed env file; never committed.
- **Accessibility (WCAG 2.1 AA)**:
  - All interactive elements reachable via keyboard.
  - Drag & drop has a keyboard equivalent.
  - Color is never the sole carrier of information (kind / priority / status all carry a label or icon as well).
  - Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text.
  - Activity feed updates are announced via `aria-live="polite"`.
  - Modals trap focus and restore it on close.
- **Reliability**:
  - All multi-row mutations run inside a DB transaction.
  - Migrations are reversible; every destructive migration is preceded by a backup step in the deploy script.
  - The service exposes `GET /api/health` returning `{ok: true, version, db: "up"}`.
- **Visual / end-to-end testing**:
  - Every key user flow has a Playwright e2e test that exercises real browser interactions
    (sign-in, create project, create task, drag card, upload attachment, post comment).
  - Every key screen has a Playwright **visual regression** test (`toHaveScreenshot()`)
    at desktop (1280×800) and mobile (390×844) viewports. Reference screenshots live
    under `tests-e2e/__screenshots__/` and are reviewed in PRs like any other code.
  - Visual diff threshold: ≤ 0.1% pixels different per screenshot before failing.
  - Pixel-diff failures are treated as bugs unless an SDD/PR explicitly approves the new look.
- **Observability**:
  - Structured JSON logs (one event per request) include `request_id`, `user_id`, `project_id`, `route`, `status`, `latency_ms`.
  - No PII in logs beyond `user_id` and email-on-error.
- **Compatibility / portability**:
  - **PostgreSQL is the primary database** (production on the Oracle Cloud VPS).
  - Local development uses Postgres too (Docker Compose or a local install) so dev/prod parity is real.
  - SQLAlchemy + Alembic — Postgres-specific features (e.g., `JSONB`, `gen_random_uuid()`, `CITEXT`) are allowed when they're the cleanest fit.
- **Deployment**:
  - Target host: **Oracle Cloud VPS** (single node), single systemd unit, same shape as today.
  - HTTPS terminates at a reverse proxy (nginx or Caddy) in front of the Python service;
    the Python `http.server` keeps listening on `127.0.0.1` only.
  - The Google OAuth redirect URI must be a stable HTTPS URL on this VPS.
  - Migration step (`alembic upgrade head`) runs before service start.
  - `scripts/build.sh` produces a `dist/` artifact ready to drop in place.
  - Attachment files live under `/var/lib/openclaw-kanban/attachments/` (configurable),
    backed up alongside the SQLite/Postgres data.

---

## 3. UI/UX Design

> Produced by the `design` agent in Phase 0. Awaiting human review before Phase 5
> starts. Methodology, expected deliverable, and acceptance criteria documented at
> the end of this section.

### 3.1 Design artifacts inventory

- **CSS custom properties** in v1 `styles.css`: a small set of color and spacing
  tokens scoped to the kanban column header / card / drag affordances. Most colors
  are still hardcoded hex; spacing is mixed `px`/`rem`. Tokens worth preserving as
  names (not necessarily values): `--bg`, `--surface`, `--border`, `--text`, `--accent`.
- **Per-team palette** in `teams.json`: hex strings used as inline backgrounds on
  team chips and card borders. v2 will keep this concept but route it through CSS
  custom properties (`--team-color`) so the tokens system stays consistent.
- **External references**: none yet. Figma file is *not* required — the project's
  scale fits Markdown wireframes + token tables. If Figma appears later, link it here.
- **Design heritage to preserve**: dense board, drag affordances, activity feed,
  team color accents on cards. These define the product's character.
- **Design heritage to drop**: hardcoded colors in JS, the per-page admin filter
  row, ad-hoc spacing, lack of empty / loading / error states.

### 3.2 Information architecture

Routes and ownership:

| Route | Purpose | Auth | Owns |
|-------|---------|------|------|
| `/login` | Google OAuth landing | public | sign-in CTA, brand mark, legal links |
| `/` | Project list (home) | user | "your projects" grid, "create project" CTA, quick switcher |
| `/p/{slug}` | Project board | member | board (4 columns), filters, activity drawer trigger |
| `/p/{slug}/tasks/{id}` | Task detail (drawer over the board) | member | task content, attachments, comments, history |
| `/p/{slug}/activity` | Full activity feed | member | paginated event list, filter by kind / actor |
| `/p/{slug}/members` | Members & roles | owner (read for member) | invite, role change, last-owner-block UX |
| `/p/{slug}/settings` | Project settings | owner | rename, teams CRUD, danger zone (delete) |
| `/settings/profile` | User profile | user | name / avatar source, sign-out |
| `/settings/tokens` | API tokens | user | create / list / revoke; plaintext shown once |
| `/404` `/403` | Error pages | any | friendly recovery; never leak existence (`/403` only used for *known* permission denials within an owned project) |

The board page is the **default destination after sign-in if the user has exactly
one project**. Otherwise, `/`. Users with zero projects land on `/` with a
prominent empty state and a "Create your first project" CTA.

### 3.3 Screens & flows (wireframes)

ASCII wireframes are intentionally low-fidelity — they pin layout and hierarchy,
not visual polish. Visual polish is locked by tokens (§3.5) and Playwright
snapshots (§6).

#### 3.3.1 Sign-in (`/login`)

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│                                                                    │
│                          🐾  Clawe Kanban                          │
│                                                                    │
│            ┌────────────────────────────────────────┐              │
│            │   [G] Continue with Google             │              │
│            └────────────────────────────────────────┘              │
│                                                                    │
│            By continuing you agree to the [terms].                 │
│                                                                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```
- States: idle / OAuth-in-flight (button → spinner) / error banner ("we couldn't
  sign you in — try again").
- No password field, no email input, no third option. Single primary CTA.

#### 3.3.2 Project list (`/`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Clawe Kanban     [  Search projects… ]      Marian ▼            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Your projects                          [ + New project ]       │
│                                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│   │ Clawe HQ     │  │ OpenClaw     │  │ Familyhub    │           │
│   │ 47 tasks     │  │ 12 tasks     │  │ 3 tasks      │           │
│   │ ▢▢ ▣ ▣      │  │ ▢ ▣          │  │ ▢            │           │
│   │ 3 members    │  │ 1 member     │  │ 2 members    │           │
│   └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```
- Empty state: centered illustration ("welcome, you have no projects") + CTA.
- Loading state: 3 skeleton cards.
- Error state: inline banner with retry.

#### 3.3.3 Project board (`/p/{slug}`) — desktop

```
┌────────────────────────────────────────────────────────────────────────┐
│  Clawe Kanban / Clawe HQ ▼      [Filter: All ▼ Mine ▼ Bug ▼]   👤👤👤  │
│                                                       [Activity] [+]   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Backlog (4)         Todo (3)          In progress (2)   Done (12)     │
│  ┌──────────────┐    ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │● task        │    │● bug   P0    │  │● proposal   │  │● task     │  │
│  │ Title here   │    │ Title here   │  │ Title here  │  │ Title     │  │
│  │ 👤 +1  📎2   │    │ 👤    💬3    │  │ 👤          │  │ 👤        │  │
│  └──────────────┘    └──────────────┘  └──────────────┘  └──────────┘  │
│  ┌──────────────┐    ┌──────────────┐                                  │
│  │● task        │    │● task        │                                  │
│  │ ...          │    │ ...          │                                  │
│  └──────────────┘    └──────────────┘                                  │
│                                                                        │
│  [+ Add task]        [+ Add task]      [+ Add task]      [+ Add task]  │
└────────────────────────────────────────────────────────────────────────┘
```
- Card chrome carries: 4-px team color on the LEFT border, kind dot at top-left
  (color-blind-safe: also a letter T/B/P inside the dot), priority chip if not P3,
  title, footer row of assignees + attachment / comment counters.
- Filters live in the header (kind, team, assignee, label, "mine") and combine.
- "Activity" button toggles a right-side drawer.
- Empty board state: a single column with helpful guidance + "+ Add your first task".

#### 3.3.4 Project board — mobile (≤ 640 px)

```
┌──────────────────────────┐
│ ☰ Clawe HQ ▼   👤  + 🔍  │
├──────────────────────────┤
│   Todo (3)               │
│ ┌──────────────────────┐ │
│ │● bug   P0           │ │
│ │ Title here           │ │
│ │ 👤  💬3              │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │● task                │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │● task                │ │
│ └──────────────────────┘ │
├──────────────────────────┤
│  ◄ Backlog  •  Todo  •   │
│   In progress  •  Done ►  │
└──────────────────────────┘
```
- Single column visible at a time; horizontal swipe (or column tabs) to switch.
- Drag & drop is replaced by a "Move" action on each card (long-press / explicit
  button) since touch DnD is too easy to misuse on small screens.

#### 3.3.5 Task detail (right-side drawer, ~480 px)

```
                                       ┌─────────────────────────────────┐
                                       │ ●bug   P0   ✕ Close             │
                                       │                                 │
                                       │ Login throws 500 on Safari      │
                                       │                                 │
                                       │ Backlog ▼   👤 Marian +  🏷 ios │
                                       │                                 │
                                       │ Description                     │
                                       │ ───────────────────────────     │
                                       │ When I sign in on Safari, I…    │
                                       │ Repro:                          │
                                       │ 1. Open …                       │
                                       │ 2. …                            │
                                       │                                 │
                                       │ [📎 screenshot1.png]            │
                                       │ [📎 screenshot2.png]            │
                                       │                                 │
                                       │ ─── Comments (3) ───            │
                                       │ Marian, 2h ago                  │
                                       │   Looks like it's the cookie…   │
                                       │ ...                             │
                                       │ [ Add comment _________  Send ] │
                                       │                                 │
                                       │ ─── History ───                 │
                                       │ Marian moved Backlog → Todo     │
                                       │ ...                             │
                                       └─────────────────────────────────┘
```
- Drawer keeps the board visible behind it on desktop; full-screen on mobile.
- Edit happens **inline** (click title → edit; click description → markdown editor with preview).
- Three sections: meta (kind / priority / column / assignees / labels / team),
  body (description + attachments), conversation (comments + activity history).

#### 3.3.6 Task creation modal

```
┌────────────────────────────────────────────────────┐
│ New                                          ✕     │
│                                                    │
│  ◉ Task    ◯ Bug    ◯ Proposal                     │
│                                                    │
│  Title                                             │
│  [_______________________________________]         │
│                                                    │
│  Column:     [ Backlog ▼ ]                         │
│  Priority:   [ P2     ▼ ]                          │
│  Team:       [ —      ▼ ]                          │
│  Assignees:  [ + Marian, +Add ]                    │
│                                                    │
│  Description (markdown)         [ Write | Preview ]│
│  ┌─────────────────────────────────────────────┐  │
│  │                                             │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  [ + Drop files / images ]                         │
│                                                    │
│                          [ Cancel ]  [ Create ]    │
└────────────────────────────────────────────────────┘
```
- Kind-specific fields appear contextually:
  - **Bug**: a "Reproduction steps" textarea pre-fills the description with
    `## Steps`, `## Expected`, `## Actual` headings.
  - **Proposal**: a "Motivation" textarea pre-fills with `## Why` / `## What`.
  - **Task**: no extras.
- Image paste (cmd-V on a screenshot) drops the file straight into the upload row.

#### 3.3.7 Activity feed (drawer)

```
                                       ┌──────────────────────────┐
                                       │ Activity   [ Filter ▼ ]  │
                                       │                          │
                                       │ ● Marian moved            │
                                       │   "Login bug" Todo→Inprog │
                                       │   2 min ago               │
                                       │                          │
                                       │ ● Marian commented on     │
                                       │   "Login bug"             │
                                       │   "Looks like the cookie…"│
                                       │   12 min ago              │
                                       │                          │
                                       │ ● Marian created           │
                                       │   bug "Login throws 500"  │
                                       │   1 h ago                 │
                                       │                          │
                                       │ ↻ load older              │
                                       └──────────────────────────┘
```
- `aria-live="polite"` on the list root; new events announced as they arrive.
- Each event has an icon glyph by kind (created / moved / commented / member added).

#### 3.3.8 Members management (`/p/{slug}/members`)

```
┌───────────────────────────────────────────────────────────────┐
│ Clawe HQ / Members                          [ + Invite ]      │
├───────────────────────────────────────────────────────────────┤
│   Marian Ortega    marian@…    owner    [ change ▼ ] [ × ]   │
│   Juan Pérez       juan@…      editor   [ change ▼ ] [ × ]   │
│   Ana López        ana@…       viewer   [ change ▼ ] [ × ]   │
└───────────────────────────────────────────────────────────────┘
```
- "Invite" opens a modal: email field + role selector. If the email is not yet
  a registered user, error: "This email hasn't signed in yet. Ask them to sign in
  with Google first."
- Last-owner safeguard: if you try to demote/remove the last owner, the row's
  action shows an inline error: *"Promote another member to owner first."*

#### 3.3.9 API tokens (`/settings/tokens`)

```
┌───────────────────────────────────────────────────────────────┐
│ API tokens                                  [ + New token ]   │
├───────────────────────────────────────────────────────────────┤
│   "openclaw-prod"     kbn_a1b2…   created 2 days ago  [×]     │
│   "local-dev"         kbn_c3d4…   created last week  [×]      │
└───────────────────────────────────────────────────────────────┘

           ┌──────────────────────────────────────────────┐
           │ Token created                              ✕ │
           │                                              │
           │ Copy your token now — you won't see it again │
           │                                              │
           │ ┌────────────────────────────────────────┐   │
           │ │ kbn_a1b2c3d4…long_string…             │   │
           │ └────────────────────────────────────────┘   │
           │                          [ Copy ] [ Done ]   │
           └──────────────────────────────────────────────┘
```

### 3.4 States

For every screen above, the standard set:

| State | Treatment |
|-------|-----------|
| **Loading** | Skeleton cards / text shimmer (no spinners on full pages); spinner only on async actions inside an already-rendered page. |
| **Empty** | Friendly icon (CSS-only shape — no asset pipeline), 1-line title, 1-line subtitle, primary CTA. Wording: directly addresses the user ("You haven't created any projects yet."). |
| **Error** | Inline banner (top of the affected region) with terse message + retry. Never throws away in-progress user input. |
| **Permission-denied** | Renders the 404 page — never reveals existence. Inside an owned project, "you can read but not edit" actions show a disabled control with a tooltip explaining the role. |

### 3.5 Design system

#### Color tokens

```
--color-bg                #f7f8fb        (light) / #0f1115 (dark, v2.1)
--color-surface           #ffffff        / #161922
--color-surface-raised    #ffffff        / #1d2230
--color-border            #e3e6ec        / #262b38
--color-text              #14171f        / #e6e9f1
--color-text-muted        #5b6477        / #9098ab
--color-text-on-brand     #ffffff
--color-brand-50          #eef1ff
--color-brand-500         #3b5bdb        (primary, AA on white = 4.6:1)
--color-brand-600         #2f49b8
--color-brand-700         #25399a
--color-success-500       #15803d
--color-warning-500       #b45309
--color-danger-500        #b91c1c
--color-info-500          #0369a1
--color-team              <bound at runtime from teams.json>
--color-kind-task         var(--color-text-muted)
--color-kind-bug          var(--color-danger-500)
--color-kind-proposal     var(--color-info-500)
```

A team color **must** pass an automated luminance check on creation; the API
rejects colors with contrast < 3:1 against `--color-surface` with a clear error.

#### Typography

System font stack:
```
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

Type scale (px / line-height):
- `--font-xs`   12 / 16
- `--font-sm`   14 / 20
- `--font-md`   16 / 24   (body)
- `--font-lg`   18 / 26
- `--font-xl`   24 / 32   (page titles)
- `--font-2xl`  32 / 40   (sign-in mark)

Weight scale: 400 (body), 500 (emphasis), 600 (titles), 700 (rare).

#### Spacing scale (4-pt)

`--space-1`=4 `--space-2`=8 `--space-3`=12 `--space-4`=16 `--space-6`=24 `--space-8`=32 `--space-12`=48

#### Radius

`--radius-sm`=4 `--radius-md`=8 `--radius-lg`=12 `--radius-pill`=999

#### Shadow

`--shadow-sm` 0 1px 2px rgba(0,0,0,.04)
`--shadow-md` 0 2px 6px rgba(0,0,0,.06)
`--shadow-lg` 0 12px 32px rgba(0,0,0,.10)

#### Motion

`--motion-fast` 120ms ease-out (hover, focus)
`--motion-base` 200ms ease (drawer, modal)
`--motion-slow` 320ms ease (board column scroll)

All motion is wrapped in `@media (prefers-reduced-motion: reduce)` overrides that
collapse durations to 0 ms.

### 3.6 Component architecture

Every component is a vanilla ES module exporting a render function that returns
a `DocumentFragment` or a single root `Element`. No global state mutation.

| Component | Props | Variants | Notes |
|-----------|-------|----------|-------|
| `TaskCard` | `(task, team, currentUser)` | by `kind`, by `priority`, dragging-state, lifted-state (kbd DnD) | Left border = team color |
| `KindBadge` | `(kind)` | task / bug / proposal | dot + letter glyph (color-blind safe) |
| `PriorityChip` | `(priority)` | P0 / P1 / P2 (P3 not rendered) | strong fill for P0, muted for P2 |
| `Avatar` | `(user, size)` | sm / md / lg / +N pile | initials fallback when avatar URL missing |
| `ColumnHeader` | `(name, count, role)` | empty (count 0) | "+" button gated by role |
| `FilterBar` | `(filters, onChange)` | desktop / mobile | controlled — emits an event |
| `ActivityItem` | `(event)` | by event kind | uses `<time datetime>` for screen readers |
| `ProjectCard` | `(project)` | empty / populated | mini board preview from counts |
| `EmptyState` | `(icon, title, body, cta)` | — | reused everywhere |
| `ErrorBanner` | `(error, onRetry)` | error / warning | dismissible |
| `Toast` | `(level, message, ariaLive)` | info / success / warning / error | auto-dismiss 5s; pinned for errors |
| `Modal` | `(title, children, onClose)` | confirm / form | focus trap + restore |
| `Drawer` | `(side, children, onClose)` | right (desktop) / sheet (mobile) | side=`sheet` slides up on mobile |
| `Dropdown` | `(trigger, items)` | menu / select | keyboard nav (↑/↓, enter, esc) |
| `MarkdownView` | `(html)` | — | inserts pre-sanitized HTML server-rendered |
| `MarkdownEditor` | `(value, onChange)` | write / preview | preview tab fetches sanitized HTML from API |
| `TokenRow` | `(token)` | active / revoked | revoke confirmation modal |
| `MemberRow` | `(member, role, viewerRole)` | last-owner-locked | inline error on demote/remove last owner |

### 3.7 Accessibility plan

- **Keyboard drag & drop**: focusable cards (`tabindex=0`) with `role=button`,
  `aria-grabbed`. **Space** lifts a card (announces "lifted, use arrow keys to move,
  space to drop, escape to cancel"); arrows navigate column/position; **Space** drops;
  **Esc** cancels and restores focus to origin. A persistent `aria-live="assertive"`
  region announces position changes.
- **Focus management**: modals & drawers trap focus and restore it on close to the
  element that opened them. Route changes move focus to the new page's `<h1>`.
- **Color contrast**: token table audited — body text 4.5:1, large text 3:1.
  Per-team colors validated by API on team creation (≥ 3:1 against surface).
- **`aria-live`**: activity feed list root is `aria-live="polite"`; toast container
  is `aria-live="assertive"`.
- **Reduced motion**: all transitions wrapped in `@media (prefers-reduced-motion: reduce)`.
- **Color-blind safety**: kind communicated by both color AND glyph (T / B / P);
  priority by both color AND label.
- **Semantic HTML**: `<main>`, `<nav>`, `<aside>` for drawer, `<dialog>` for modal,
  `<button>` everywhere clickable, headings descend properly.
- **Screen reader board model**: each column is `role="list"` with an `aria-label`
  (column name + count); each card is `role="listitem"`.
- **Forms**: every input has a real `<label>`; error messages tied via `aria-describedby`.
- **Smoke test**: `@axe-core/playwright` runs against every visual route in CI;
  zero serious/critical WCAG 2.1 AA violations is a merge gate.

### 3.8 Visual identity refresh — what changes vs what stays

**Stays (intentionally):**
- 4-column kanban shape (Backlog / Todo / In progress / Done).
- Drag & drop as the primary card-move interaction on desktop.
- Team color as a card accent.
- Activity feed as a first-class surface.

**Changes:**
- Real design system replaces hardcoded values; per-team color routed through
  CSS custom properties.
- Card layout: more breathing room, kind/priority chips, attachment + comment
  counters, assignee pile.
- Filter bar moves from per-page admin row to project header.
- Activity feed becomes a dockable side drawer (still has a full page at
  `/p/{slug}/activity` for deep history).
- Mobile becomes first-class — single-column-at-a-time pattern.
- Adds: sign-in page, project list, member management, token management, empty/loading/error states.

**Branding:**
- Wordmark "Clawe Kanban" with a 🐾 prefix glyph.
- Brand color `--color-brand-500` (`#3b5bdb`) — confident blue, not aggressive.
- No mascot illustration; CSS-only icons for empty states.

### 3.9 Methodology, deliverable shape & acceptance

**Approach.** Every section above is the deliverable of Phase 0, produced acting
as the `design` agent (`.claude/agents/design.md`). Iteration before approval is
expected — wireframes, tokens, and components are documents, not contracts.

**Acceptance criteria.** Phase 0 is "done" — and Phase 5 unblocks — when:

- Every P0 user story in §2 has a wireframe / flow that satisfies it.
- The token list maps cleanly onto CSS variables to be implemented in Phase 5.
- Every accessibility NFR in §2 is addressed in §3.7.
- §6 visual regression list (routes × viewports) matches §3.2 / §3.3.
- The user explicitly approves §3 (gate before Phase 5).

### 3.10 Stitch exploration — selected variants

We pushed the wireframes through Stitch (Google) and generated 3 variants per
hero screen, then the user picked the directions to build against. These picks
**override** anything inconsistent in the wireframes above; the Phase 5
implementation must follow them.

| Screen | Selected variant | What it locks in |
|--------|------------------|------------------|
| **Project board** | **V1 · Priority-first** | The highest-priority bug (P0) gets a subtle red-tinted background and a thicker red left border. When the "Mine" filter is active, cards not assigned to me drop to ~50 % opacity. The topbar merges breadcrumb + project switcher into a single compact line; `⌘N` (and similar shortcut hints) appear in low-contrast text next to actions that have shortcuts. |
| **Task detail drawer** | **V2 · Triage rápido** | Status and priority are surfaced in a prominent header column near the title (not as small chips lost in the corner). A "Blocked by" warning indicator lives in the same header band when applicable. Image attachments render as 64 px square thumbnails (filename row only for non-images). The sticky drawer footer features "Move to In progress" as a large primary button — most-likely-next-step front and center. |
| **Project list / home** | **V3 · Productivity dashboard** | Sort tabs (Recently active / A-Z / Assigned) sit to the left of "+ New project" so they're discoverable without crowding the CTA. Mini-board previews communicate health: a project in trouble shows a red-tinted "In progress" segment; a project with 0 tasks shows a subtle empty bar. Edge cases handled visibly: ellipsis on long titles, "Viewer" role chip for projects you don't own. |
| **Sign-in** | **All 4 states approved** (idle / loading / error / rejection) | All four states ship as designed. Idle = single Google CTA, no second auth path. Loading = button collapses to spinner with text "Signing you in…" and disables. Error = danger-tinted banner above the button with "We couldn't sign you in. Try again or [contact support]." (button stays clickable for retry). Rejection (allow-list) = warning-tinted banner: "This email isn't authorized for this deployment. Ask the admin to add you." All banners have role="alert" and meet WCAG AA contrast. |
| **Task creation modal** | **V3 · Narrativa** | Description editor is the modal's center of gravity: tabs "Write \| Preview" with high-contrast active state, plus a dedicated markdown shortcut hint row at the bottom of the editor (`**bold** _italic_ \`code\` — preview`). Kind switcher hints appear instantly on hover/select (Task: "Standard work item", Bug: "Structured repro steps", Proposal: "Discussion-first"). A subtle 11 px "You have unsaved changes" label sits to the left of Cancel when the form is dirty. |
| **Project board (mobile)** | **V2 · Edge cases** | Mobile board renders the realistic edge cases: a card whose title wraps cleanly to exactly two lines before truncating with ellipsis; a card showing an avatar pile of four with a `+2` overflow indicator while keeping every interactive element ≥ 44×44 px. Pull-to-refresh hint at the top of the column list. Small dots on non-active column tabs (Backlog / Done) signal new activity without forcing a switch. P0 bug card carries the desktop tint+2 px red border treatment scaled to mobile. |
| **Members management** | **V1 · Bulk admin** | High-density multi-column table designed for 10–30 members. Every row has a checkbox; selecting 1+ reveals a sticky "Bulk actions" bar at the bottom (Change role for selected · Remove selected) which is hidden when nothing is selected. Search + role filter row above the table with a live "Showing N of M" count. Inline last-owner protection note + dropdown-level disabled "Demote" stays. |
| **API tokens** | **V2 · Security-first** | Quiet info banner at the top: "Tokens never expire automatically. Rotate every 90 days for high-value automation." Search bar supports filtering by "Unfamiliar IPs" so a developer can spot leaked tokens fast. Every active token row stacks rich metadata: name, prefix, created, "Last seen" line with IP + user-agent + a small warning icon next to unfamiliar-IP entries. Active and Revoked sections are separated by a horizontal divider with count headers. Revoke triggers a 400 px confirmation modal: "Revoke openclaw-prod? Any automation using it will start failing immediately. This cannot be undone." |

Phase 5 (`static/`) starts from these eight picks. Re-running Stitch on these
screens later requires an SDD update; do not introduce drift silently.

---

## 4. Architecture

### Overview

v2 is a near-total rewrite of the backend with the existing vanilla-JS frontend
restructured (not rebuilt) on top of a new API. The current single-file `server.py`
(stdlib `ThreadingHTTPServer` + JSON files) cannot reasonably absorb OAuth, multi-tenant
scoping, file uploads, schema migrations, OpenAPI docs, and per-user tokens without
becoming a 3000-line nightmare. So we accept one big architectural shift and then
hold the line on simplicity.

#### Architectural decisions

| # | Decision | Rationale |
|---|----------|-----------|
| A1 | **Backend framework: FastAPI** (instead of stdlib `http.server`). | Native pydantic v2 validation, automatic OpenAPI docs (free contract for OpenClaw), small dependency surface, ASGI plays nicely behind nginx + uvicorn. Stdlib `http.server` is fine for v1's scope but not for v2's. |
| A2 | **ASGI server: uvicorn[standard]** managed by systemd, listening on `127.0.0.1`. | Reverse proxy (nginx or Caddy) on the Oracle VPS terminates HTTPS and forwards to uvicorn. |
| A3 | **ORM: SQLAlchemy 2.0 (async) + Alembic migrations.** | Industry standard, dialect-portable (we still pin Postgres but ORM keeps options open), versioned schema, reversible migrations. |
| A4 | **Driver: `psycopg[binary]` (sync) initially.** | Async SQLAlchemy is fine but adds testing friction. We'll start with sync sessions inside FastAPI dependencies, migrate to async later if profiling demands it. |
| A5 | **Auth: Google OAuth 2.0 + server-side cookie sessions** for humans; **per-user bearer tokens (argon2id-hashed)** for machines. | Matches the §7 decisions; sessions are simpler than stateless JWT and revocation is real. |
| A6 | **Frontend stays vanilla JS, restructured.** | No React/Vue, no bundler. Modules served as native ES modules (`<script type="module">`). Server renders the initial HTML for login/listing pages via Jinja2 templates; the board hydrates with vanilla JS. |
| A7 | **Markdown rendered server-side with `markdown-it-py` + `bleach`.** | API returns both raw markdown and pre-sanitized HTML. The frontend never executes a markdown parser. |
| A8 | **File storage: `StorageBackend` Protocol with a filesystem implementation.** | Dependency-injected, lets us swap to S3-compatible later without API changes. Files live under `/var/lib/openclaw-kanban/attachments/<sha256-prefix>/<storage_key>`. |
| A9 | **Multi-tenant gate is a single FastAPI dependency.** | `get_project_member(user, project_id) -> Membership` raises `404` (not `403`) if the user is not a member. Every project-scoped route depends on it; "we forgot to scope" becomes structurally impossible. |
| A10 | **Soft cut for the API.** | Legacy `/api/{tasks,activity,teams}` continues to work (mapped to the `Clawe HQ` project, still gated by the shared `KANBAN_TOKEN`) until OpenClaw is migrated. v2 lives under `/api/v2/*`. |
| A11 | **Playwright for e2e + visual regression testing.** | A second test suite (alongside pytest) drives a real Chromium against a test backend, asserting both behavior (drag & drop, OAuth-stubbed sign-in, attachment upload) and visuals (pixel-diff snapshots per route × viewport). Lives in `tests-e2e/`, runs in CI after pytest passes. Picked over Cypress for its native cross-browser support and `toHaveScreenshot()` diffing. |

Decisions A1 and A6 are the load-bearing ones — confirm or push back before Phase 2.

### Data model

All tables live in a single Postgres schema. UUID primary keys via `gen_random_uuid()`
(extension: `pgcrypto`). Timestamps in UTC, `TIMESTAMPTZ`. Enums modelled as
`TEXT CHECK (col IN (...))` for portability rather than native Postgres enums.

```
users
  id              UUID PK
  google_sub      TEXT UNIQUE NOT NULL
  email           CITEXT UNIQUE NOT NULL
  name            TEXT
  avatar_url      TEXT
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  last_seen_at    TIMESTAMPTZ

api_tokens
  id              UUID PK
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
  name            TEXT NOT NULL
  token_hash      TEXT NOT NULL                 -- argon2id of plaintext
  prefix          TEXT NOT NULL                 -- first 8 chars of plaintext, for display
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  last_used_at    TIMESTAMPTZ
  revoked_at      TIMESTAMPTZ
  INDEX (user_id, revoked_at)

sessions
  id              TEXT PK                       -- random 32 bytes hex
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  last_seen_at    TIMESTAMPTZ NOT NULL
  expires_at      TIMESTAMPTZ NOT NULL
  user_agent      TEXT
  INDEX (user_id)
  INDEX (expires_at)

oauth_states
  state           TEXT PK                       -- random nonce
  redirect_to     TEXT
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()  -- TTL purged in a periodic job

projects
  id              UUID PK
  slug            TEXT UNIQUE NOT NULL
  name            TEXT NOT NULL
  created_by      UUID NOT NULL REFERENCES users(id)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  deleted_at      TIMESTAMPTZ
  INDEX (deleted_at)

project_members
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
  role            TEXT NOT NULL CHECK (role IN ('owner','editor','viewer'))
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  PRIMARY KEY (project_id, user_id)
  INDEX (user_id)

teams
  id              UUID PK
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE
  name            TEXT NOT NULL
  color           TEXT NOT NULL                 -- e.g. "#3b82f6"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  UNIQUE (project_id, name)
  INDEX (project_id)

tasks
  id              UUID PK
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE
  kind            TEXT NOT NULL CHECK (kind IN ('task','bug','proposal'))
  column          TEXT NOT NULL CHECK (column IN ('backlog','todo','inprogress','done'))
  position        DOUBLE PRECISION NOT NULL     -- fractional indexing for cheap reorders
  priority        TEXT CHECK (priority IN ('P0','P1','P2','P3'))
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL
  title           TEXT NOT NULL
  description_md  TEXT NOT NULL DEFAULT ''
  description_html TEXT NOT NULL DEFAULT ''     -- pre-sanitized
  labels          TEXT[] NOT NULL DEFAULT '{}'  -- Postgres array
  created_by      UUID NOT NULL REFERENCES users(id)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  deleted_at      TIMESTAMPTZ
  INDEX (project_id, column, position)
  INDEX (project_id, kind)
  INDEX (project_id, deleted_at)

task_assignees
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
  PRIMARY KEY (task_id, user_id)
  INDEX (user_id)

attachments
  id              UUID PK
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE   -- denormalized for fast isolation checks
  original_name   TEXT NOT NULL
  mime            TEXT NOT NULL
  size_bytes      BIGINT NOT NULL
  storage_key     TEXT NOT NULL                 -- opaque, never user-supplied
  uploaded_by     UUID NOT NULL REFERENCES users(id)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  deleted_at      TIMESTAMPTZ
  INDEX (task_id)
  INDEX (project_id)

comments
  id              UUID PK
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE   -- denormalized
  user_id         UUID NOT NULL REFERENCES users(id)
  body_md         TEXT NOT NULL
  body_html       TEXT NOT NULL
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  deleted_at      TIMESTAMPTZ
  INDEX (task_id, created_at)

activity_events
  id              UUID PK
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE
  user_id         UUID REFERENCES users(id)     -- nullable: 'system' actor for migrations
  kind            TEXT NOT NULL                 -- e.g. 'task.created', 'task.moved', 'member.added'
  target_type     TEXT NOT NULL                 -- 'task' | 'project' | 'comment' | 'member' | ...
  target_id       UUID
  payload         JSONB NOT NULL DEFAULT '{}'   -- before/after snapshots, descriptive fields
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  INDEX (project_id, created_at DESC)
  INDEX (target_type, target_id)
```

#### Notes on the model

- **Fractional `position`** (DOUBLE PRECISION) lets a card move between two neighbours
  with a single `UPDATE` (`(prev.position + next.position) / 2`). Periodic re-balancing
  job runs only if positions get too close.
- **Denormalized `project_id`** on `attachments` and `comments` lets the multi-tenant
  isolation check happen with a single index lookup instead of a join.
- **`labels` as `TEXT[]`** keeps the schema small for the P1 feature; we can promote
  to a `labels` table later if cardinality demands it.
- **`activity_events.payload` as JSONB** keeps the events table generic without
  needing a migration every time we log a new event kind.

### API contracts

All `/api/v2/*` endpoints accept either a session cookie (browser) OR an
`Authorization: Bearer kbn_<token>` header (programmatic). Both resolve to a `User`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/health` | none | `{ok, version, db}` |
| GET    | `/api/v2/me` | user | Current user identity |
| POST   | `/api/v2/tokens` | user (cookie only) | Create personal API token; **plaintext returned once** |
| GET    | `/api/v2/tokens` | user | List my tokens (no plaintext, only prefix) |
| DELETE | `/api/v2/tokens/{id}` | user | Revoke a token |
| GET    | `/api/v2/projects` | user | Projects I'm a member of |
| POST   | `/api/v2/projects` | user | Create project; creator becomes `owner` |
| GET    | `/api/v2/projects/{id}` | member | Details + members + teams |
| PATCH  | `/api/v2/projects/{id}` | owner | Rename / soft delete |
| POST   | `/api/v2/projects/{id}/members` | owner | Invite by email (must be an existing user) |
| PATCH  | `/api/v2/projects/{id}/members/{user_id}` | owner | Change role (blocks demoting last owner) |
| DELETE | `/api/v2/projects/{id}/members/{user_id}` | owner+self | Remove (blocks removing last owner) |
| GET    | `/api/v2/projects/{id}/teams` | member | List teams |
| POST   | `/api/v2/projects/{id}/teams` | editor+ | Create team |
| PATCH  | `/api/v2/projects/{id}/teams/{team_id}` | editor+ | Update |
| DELETE | `/api/v2/projects/{id}/teams/{team_id}` | editor+ | Delete (tasks fall back to `team_id=NULL`) |
| GET    | `/api/v2/projects/{id}/tasks` | member | List with `?kind=&column=&assignee=&label=&q=&since=&limit=&cursor=` |
| POST   | `/api/v2/projects/{id}/tasks` | editor+ | Create task |
| GET    | `/api/v2/projects/{id}/tasks/{task_id}` | member | Task + assignees + attachments + comment count |
| PATCH  | `/api/v2/projects/{id}/tasks/{task_id}` | editor+ | Partial update |
| POST   | `/api/v2/projects/{id}/tasks/{task_id}/move` | editor+ | Atomic `{column, before_id?, after_id?}` |
| DELETE | `/api/v2/projects/{id}/tasks/{task_id}` | editor+ | Soft delete |
| POST   | `/api/v2/projects/{id}/tasks/{task_id}/attachments` | editor+ | `multipart/form-data` upload |
| GET    | `/api/v2/attachments/{id}` | member | Metadata |
| GET    | `/api/v2/attachments/{id}/raw` | member | Stream the file with proper `Content-Type` |
| DELETE | `/api/v2/attachments/{id}` | editor+ | Soft delete (file kept until purged) |
| GET    | `/api/v2/projects/{id}/tasks/{task_id}/comments` | member | List |
| POST   | `/api/v2/projects/{id}/tasks/{task_id}/comments` | editor+ | Add |
| PATCH  | `/api/v2/comments/{id}` | author | Edit |
| DELETE | `/api/v2/comments/{id}` | author or owner | Soft delete |
| GET    | `/api/v2/projects/{id}/activity` | member | Cursor-paginated `?cursor=&limit=` |

Errors are JSON: `{"error": {"code": "string", "message": "string", "fields": {...}}}`.
Codes: `unauthenticated`, `unauthorized`, `not_found`, `conflict`, `validation_error`,
`rate_limited`, `internal`. Multi-tenant misses always return `not_found`, never `unauthorized`.

Legacy v1 endpoints (`/api/tasks`, `/api/activity`, `/api/teams`) keep their current
shape and the shared `KANBAN_TOKEN` auth, mapped to the `Clawe HQ` project. Each
response carries `Deprecation: true` and `Sunset: <date>` headers.

### Key dependencies

**Runtime (Python):**

```
fastapi
uvicorn[standard]
sqlalchemy>=2.0
alembic
psycopg[binary]
pydantic>=2
pydantic-settings
python-multipart
authlib                 # Google OAuth helper
itsdangerous            # signed cookies for sessions
argon2-cffi             # API token hashing
markdown-it-py
bleach
jinja2                  # templates for login/landing pages
python-magic            # MIME sniffing on upload
```

**Dev:**

```
ruff
mypy
pytest
pytest-cov
httpx                   # FastAPI TestClient
factory-boy
```

**Frontend (runtime):** still no runtime deps.

**Frontend (dev / e2e):**

```
@playwright/test
eslint        (already configured)
```

Playwright pulls its own Chromium / Firefox / WebKit binaries on `npx playwright install`.

**Infra (Oracle VPS):**

- nginx (or Caddy) for HTTPS + reverse proxy to `127.0.0.1:8787`
- PostgreSQL 16
- systemd unit (new: `openclaw-kanban-v2.service`)
- Filesystem dir `/var/lib/openclaw-kanban/attachments/` owned by the service user

### Risks & considerations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| FastAPI migration scope creep | high | Phased delivery; v1 stays online during soft cut. |
| OAuth redirect URI mismatch in prod | medium | Document `OAUTH_REDIRECT_URI` env var; fail loudly at startup if missing. |
| Multi-tenant scoping forgotten on a new endpoint | high | Every project-scoped route depends on `get_project_member`; lint rule + a test that loops every router and verifies dependency presence. |
| XSS via markdown | medium | `bleach` allow-list of tags/attrs; integration tests with known XSS payloads. |
| Attachment URL leaks | medium | All downloads go through an auth-checked endpoint; storage keys never appear in URLs. |
| Postgres dev parity | medium | `docker-compose.dev.yml` + `make dev`; CI runs against the same Postgres major version. |
| v1 importer skews / re-runs duplicate data | medium | Idempotent: keys on `(legacy_id, project_id)`; documented dry-run mode. |
| systemd / nginx misconfig in prod | medium | Ship `deploy/*.example` files and a runbook (`docs/ops.md`) generated as part of phase 7. |
| Vanilla JS structure decays as features grow | low | Strict module boundaries (`board.js`, `tasks.js`, `api.js`, `activity.js`); ESLint enforces no cross-module side effects. |
| Visual snapshots become noisy / flaky | medium | Stub time/UUIDs/avatars in the e2e harness for deterministic renders; mask volatile regions with `mask: [locator]`; commit screenshots only from CI's reference platform (Linux Chromium) to avoid OS font drift. |
| OAuth flow is hard to drive from a test browser | medium | A `TEST_AUTH_BYPASS=1` env var enables a dev-only `/auth/test-login?email=...` endpoint that creates a session directly. Disabled in production by config check at startup. |

---

## 5. Implementation Plan

Each phase ends with `ruff check . && mypy server && npx eslint static/js && pytest`
all green. From Phase 5 onward, `npx playwright test` is also gated. The QA agent
runs after every Stop hook to keep test coverage tight.

Phase 0 is design-only (no code). Phases 1–4 can run before Phase 0 is fully done
because they're backend-only, but **Phase 5 (frontend) is blocked on Phase 0 approval**.

### Phase 0 — UX/UI redesign proposal (no code) ✅
- [x] Run `/project:design kanban-v2` — invokes the `design` agent
- [x] Inventory existing design artifacts (CSS custom properties, `teams.json` colors, any Figma) — research only
- [x] Sitemap and screen inventory aligned to v2 routes — populates §3 *Information architecture*
- [x] Wireframes / sketches for every P0 screen × every state (loading / empty / populated / error / permission-denied) — populates §3 *Screens & flows* and *States*
- [x] Token table (color, typography, spacing, radii, shadows, motion) + decision on extending vs refactoring v1 CSS variables — populates §3 *Design system*
- [x] Reusable component list with props/variants — populates §3 *Component architecture*
- [x] Accessibility plan covering keyboard drag & drop, focus management, contrast, `aria-live`, reduced motion — populates §3 *Accessibility plan*
- [x] Before/after summary of the visual identity refresh — populates §3 *Visual identity refresh*
- [x] **Stitch exploration**: pushed wireframes through Stitch in 2 rounds, generated 32 screens (8 hero × 1 original + 3 variants, except sign-in which generated 4 state variants), user picked the 8 directions to build against — locked in §3.10
- [x] Update §6 visual regression route × viewport list to match the new screens
- [x] Surface any new open questions back to §7
- [x] **Gate**: user reviewed and approved §3 (rounds 1+2 locked 2026-04-26)

### Phase 1 — Foundation & dev environment ✅
- [x] Create `pyproject.toml` with deps + ruff + mypy + pytest config — `pyproject.toml`
- [x] Set up dev DB: `docker-compose.dev.yml` with Postgres 16 — `docker-compose.dev.yml`
- [x] FastAPI skeleton with health endpoint — `server/main.py`, `server/config.py`, `server/db.py`
- [x] Alembic init + initial migration (enables `pgcrypto` + `citext`) — `alembic.ini`, `server/migrations/env.py`, `server/migrations/script.py.mako`, `server/migrations/versions/0001_init.py`
- [x] `Makefile` with `dev`, `test`, `lint`, `migrate`, `e2e`, `build` — `Makefile`
- [x] `tests/conftest.py` with Postgres test fixture (auto-creates `kanban_test` DB) — `tests/conftest.py`
- [x] First test: `GET /api/health` returns `{ok: true, db: "up"}` — `tests/test_health.py`
- [x] `.env.example` with all settings documented — `.env.example`
- [x] README dev-setup section — `README.md`
- [ ] **User-side verification**: `make install && make db-up && make migrate && make test` (cannot be run inside this Claude Code session — no Docker access).

### Phase 2 — Data model & auth
- [ ] All SQLAlchemy models — `server/models/*.py`
- [ ] First real migration with full schema + `pgcrypto` extension — `server/migrations/versions/0002_initial_schema.py`
- [ ] Pydantic schemas — `server/schemas/*.py`
- [ ] Google OAuth flow (start/callback) + cookie sessions — `server/auth/google_oauth.py`, `server/auth/sessions.py`, `server/auth/routes.py`
- [ ] API tokens (create, list, revoke) with argon2id — `server/auth/tokens.py`, `server/api/v2/tokens.py`
- [ ] FastAPI dependencies: `get_current_user`, `get_project_member` — `server/deps.py`
- [ ] `/api/v2/me` — `server/api/v2/me.py`
- [ ] Tests: OAuth happy/error paths, token CRUD, isolation gate behaviour — `tests/test_auth_oauth.py`, `tests/test_auth_tokens.py`, `tests/test_isolation_gate.py`

### Phase 3 — Projects, teams, tasks
- [ ] Projects API (CRUD, members, role enforcement, last-owner block) — `server/api/v2/projects.py`
- [ ] Teams API — `server/api/v2/teams.py`
- [ ] Tasks API (CRUD, list with filters, atomic move with fractional positions) — `server/api/v2/tasks.py`
- [ ] Activity event writer (called from project/task mutations) — `server/services/activity.py`
- [ ] Activity feed API (cursor pagination) — `server/api/v2/activity.py`
- [ ] Tests: full multi-tenant isolation matrix — `tests/test_projects.py`, `tests/test_tasks.py`, `tests/test_isolation_matrix.py`

### Phase 4 — Markdown, attachments, comments
- [ ] Markdown service (`markdown-it-py` + `bleach` allow-list) — `server/markdown.py`, `tests/test_markdown.py`
- [ ] `StorageBackend` Protocol + filesystem implementation — `server/storage/base.py`, `server/storage/filesystem.py`
- [ ] Attachment upload + auth-gated stream + delete — `server/api/v2/attachments.py`
- [ ] Comments API — `server/api/v2/comments.py`
- [ ] Tests: XSS payloads in markdown, attachment isolation, oversized upload rejection — `tests/test_markdown_xss.py`, `tests/test_attachments_isolation.py`, `tests/test_comments.py`

### Phase 5 — Frontend

> Implementation strictly follows §3.10 picks. Reference HTMLs live under
> `design-preview/stitch/` (those are visual reference only — Phase 5 produces
> the production templates and JS modules from scratch, not by copying Stitch HTML).

- [ ] Jinja templates for login (4 states from §3.10) + project list + token management — `server/templates/*.html`
- [ ] CSS refactor: keep tokens, add multi-project layout — `static/css/styles.css`
- [ ] `static/js/api.js` — fetch helper that handles cookie + token, errors, retries
- [ ] `static/js/board.js` — board render, drag & drop with keyboard fallback
- [ ] `static/js/tasks.js` — create/edit modal with markdown preview (server-rendered)
- [ ] `static/js/attachments.js` — upload UI, image previews
- [ ] `static/js/activity.js` — polling renderer with `aria-live`
- [ ] `static/js/filters.js` — kind/team/assignee/label filters
- [ ] `static/js/projects.js` — project switcher
- [ ] ESLint config tightened for ES modules + no cross-module mutation — `package.json`, `.eslintrc.json`
- [ ] **Playwright setup** — install, config, fixtures (test user, project, task), test-auth-bypass route — `playwright.config.ts`, `tests-e2e/fixtures/*.ts`, `server/auth/test_bypass.py`
- [ ] **Behavioral e2e tests**: sign in, create project, create task, drag card across columns, upload image, post comment — `tests-e2e/auth.spec.ts`, `tests-e2e/projects.spec.ts`, `tests-e2e/tasks.spec.ts`, `tests-e2e/attachments.spec.ts`
- [ ] **Visual regression tests** for: login page, empty project list, board (empty / populated), task detail modal, activity feed; at desktop (1280×800) and mobile (390×844) — `tests-e2e/visual.spec.ts`, `tests-e2e/__screenshots__/`
- [ ] Make/script targets: `make e2e`, `make e2e-update` (refresh screenshots) — `Makefile`

### Phase 6 — v1 → v2 migration
- [ ] `scripts/import_v1.py` — idempotent import into `Clawe HQ` project — `scripts/import_v1.py`
- [ ] Tests with a real v1 snapshot — `tests/test_import_v1.py`, `tests/fixtures/v1_snapshot/*.json`
- [ ] Legacy v1 router (`/api/{tasks,activity,teams}`) wrapping the new model, gated by `KANBAN_TOKEN`, with `Deprecation`/`Sunset` headers — `server/api/v1_legacy.py`, `tests/test_v1_legacy.py`

### Phase 7 — Build & deploy
- [ ] `scripts/build.sh` produces `dist/` (server, static, migrations, requirements lock, BUILD_INFO) — `scripts/build.sh`
- [ ] Systemd unit for v2 + EnvironmentFile example — `systemd/openclaw-kanban-v2.service.example`, `deploy/env.example`
- [ ] Nginx example config (HTTPS → uvicorn) — `deploy/nginx.conf.example`
- [ ] Ops runbook (deploy, rollback, backup, OAuth setup) — `docs/ops.md`
- [ ] GitHub Actions CI: lint + typecheck + pytest + Playwright e2e + visual diff on every PR — `.github/workflows/ci.yml`
  - CI is the canonical reference platform for screenshots (Linux Chromium); local diffs are advisory only
  - Failed visual diffs upload the diff image as a PR artifact for review

### Phase 8 — Cutover & cleanup
- [ ] Migrate OpenClaw scripts to `/api/v2/*` + per-user tokens (out-of-repo work)
- [ ] Verify v1 has no callers (access logs)
- [ ] Remove legacy `server.py`, `app.js`, `index.html`, `styles.css`, `tasks.json`/`activity.json`/`teams.json` (archive a snapshot first)
- [ ] Update README to v2 only

### Files to create (high-level)

```
server/                       (new package)
  main.py, config.py, db.py, deps.py, markdown.py
  auth/        google_oauth.py, sessions.py, tokens.py, routes.py
  models/      user, project, task, attachment, comment, team, activity, api_token, session
  schemas/     mirrors models/
  api/v2/      projects, tasks, attachments, comments, teams, activity, tokens, me
  api/         health.py, v1_legacy.py
  services/    activity.py, ordering.py
  storage/     base.py, filesystem.py
  migrations/  alembic env + versions/

static/
  css/styles.css   (rewritten)
  js/{api,board,tasks,attachments,activity,filters,projects}.js
  img/             (optional)

server/templates/{base,login,project_list,tokens}.html

scripts/{build.sh, import_v1.py, seed_dev.py}
tests/        (pytest backend suite — see phases)
tests-e2e/    (Playwright e2e + visual regression)
  fixtures/, *.spec.ts, __screenshots__/
deploy/{env.example, nginx.conf.example}
docs/ops.md
docker-compose.dev.yml
pyproject.toml, alembic.ini, Makefile
playwright.config.ts, package.json (eslint + @playwright/test)
.github/workflows/ci.yml
systemd/openclaw-kanban-v2.service.example
```

### Files to modify

- `README.md` — dev setup, OAuth setup, deploy instructions for v2
- `CLAUDE.md` — update Stack section once FastAPI lands; commands change
- `.claude/commands/{prime,validate,implement}.md` — update lint/typecheck/test commands once `pyproject.toml` is in place
- `.claude/settings.json` — extend permissions (`Bash(uvicorn:*)`, `Bash(docker compose:*)`, `Bash(alembic:*)` already allowed)
- `.gitignore` — add `dist/`, `*.egg-info/`, `__pypackages__/`, `.venv/`, attachments dir if used in dev

### Files to delete (in Phase 8 only)

- `server.py`, `app.js`, `index.html`, `styles.css`
- `tasks.json`, `activity.json`, `teams.json` (after archiving a snapshot)
- `systemd/openclaw-kanban.service.example`

---

## 6. Testing Strategy

The QA agent will fill in coverage details per feature, but the overall shape is set:

### Backend (pytest)
- **Unit**: pure functions (markdown sanitization, fractional position math, token hashing).
- **Integration**: API tests using FastAPI's `TestClient` against a real Postgres test DB
  (per-test transaction rollback). Every endpoint has happy-path + at least one error-path test.
- **Multi-tenant isolation**: a generated matrix iterating every `/api/v2/*` endpoint
  with a non-member user; expected: `404` everywhere, no leaks. Run on every PR.
- **Migration tests**: Alembic up/down + `import_v1.py` against a fixed v1 snapshot.
- **Coverage target**: ≥ 80% line, ≥ 95% on auth, multi-tenant, persistence.

### Frontend (Playwright)
- **Behavioral e2e** (`tests-e2e/*.spec.ts`):
  - Sign in (via `TEST_AUTH_BYPASS`), create project, invite member, log out.
  - Create task, edit title, edit markdown description, see HTML preview.
  - Drag a card across columns; verify both DOM order and server state.
  - Keyboard equivalent: move a card via shortcut; verify same outcome.
  - Upload an image attachment; verify isolation (a member of another project cannot fetch).
  - Post a comment; verify XSS payload is stripped.
- **Visual regression** (`tests-e2e/visual.spec.ts`):
  - Routes covered: `/login` (idle + error), `/` (empty + populated + loading), `/p/{slug}` (empty board + populated board + activity drawer open), `/p/{slug}/tasks/{id}` (drawer over board), task creation modal (each kind: task / bug / proposal), `/p/{slug}/members`, `/p/{slug}/settings`, `/settings/tokens` (list + post-create reveal modal), `404`.
  - Viewports: desktop 1280×800 + mobile 390×844.
  - Determinism: seeded data, frozen clock, masked avatars / timestamps.
  - Reference screenshots committed under `tests-e2e/__screenshots__/<test>-<viewport>.png`.
  - Threshold: `maxDiffPixelRatio: 0.001`.
  - Updating goldens: `make e2e-update` only runs in CI's reference container, never on
    a developer's local machine (avoids OS font drift sneaking into the baseline).
- **a11y smoke**: `@axe-core/playwright` on each visual route asserts zero violations of
  WCAG 2.1 AA serious/critical rules.

### CI (GitHub Actions)
1. Lint (ruff + eslint)
2. Typecheck (mypy)
3. pytest (backend, with Postgres service container)
4. Playwright e2e + visual + a11y (uvicorn started in the runner)
5. Build (`scripts/build.sh`)

Steps 1–4 must all pass to merge. Visual diffs upload to the PR as artifacts when they fail.

---

## 7. Open Questions

Resolved (2026-04-25):

- [x] **Auth model — primary**: **Google OAuth 2.0 (Gmail sign-in)** for humans + per-user API tokens for OpenClaw.
- [x] **Hosting model**: single self-hosted deployment on **Oracle Cloud VPS**. SaaS hooks deferred to v3.
- [x] **Image / file storage backend**: **filesystem** under `/var/lib/openclaw-kanban/attachments/`, behind a thin storage abstraction so S3 can plug in later.
- [x] **Database**: **PostgreSQL** in production AND in development (Docker Compose locally) so dev/prod parity is real. SQLite is not supported.
- [x] **Live updates**: **Polling** every 5–10 s. SSE/WebSocket deferred.
- [x] **Markdown renderer**: **server-side** with `markdown-it-py` + `bleach`; the frontend stays vanilla and only inserts pre-sanitized HTML.
- [x] **API versioning cutover**: **soft cut** — v1 endpoints stay online with `Deprecation`/`Sunset` headers until OpenClaw is fully migrated, then v1 is removed.
- [x] **Ownership transfer**: **block last-owner removal** with an explicit error; promotion of a new owner is required before the previous owner can leave.
- [x] **v1 default project name on import**: **`Clawe HQ`**.

All §7 product/scope questions are resolved.

Resolved (2026-04-25, post-plan):

- [x] **A1 — adopt FastAPI** (replace `server.py` stdlib `http.server`). Confirmed by user.
- [x] **A6 — vanilla JS frontend** with ES modules + Jinja2 shells; no bundler. Confirmed by user.
- [x] **A11 — Playwright** for behavioral e2e + visual regression + a11y smoke. Confirmed by user.

Surfaced from §3 (Phase 0 design proposal — pending user review):

- [ ] **Task detail surface — drawer vs full page**: §3.3.5 proposes a right-side drawer that keeps the board visible behind it (sheet on mobile). Recommendation: drawer.
- [ ] **Mobile DnD strategy**: §3.3.4 replaces touch drag with an explicit "Move" action on each card to avoid mis-drags. Recommendation: keep DnD desktop-only, "Move" menu on touch.
- [ ] **Dark mode timing**: §2 has it as P2 (deferred). Tokens are written so dark mode is a values swap when we ship it. Recommendation: ship light only at v2.0; dark mode lands in v2.1.
- [ ] **Brand glyph**: `🐾` emoji prefix on the wordmark. Recommendation: keep emoji at v2.0 (zero asset cost), revisit a custom glyph at v2.1.
- [ ] **Team color contrast enforcement**: API rejects team colors with contrast < 3:1 against `--color-surface`. Recommendation: enforce as proposed; document in admin error message.
  *Recommendation: support both via SQLAlchemy; default to SQLite locally, document Postgres for shared.*
- [ ] **Realtime updates**: polling (current pattern) or Server-Sent Events?
  *Recommendation: keep polling for v2.0; SSE in v2.1 if needed.*
- [ ] **Markdown renderer**: server-side render with a sanitizer (e.g., `bleach`), or
  client-side render with a vetted JS library? *Recommendation: server-side with
  `bleach` to keep the vanilla-JS frontend small.*
- [ ] **API versioning cutover**: keep `/api/*` (v1) alongside `/api/v2/*` during
  transition, or hard-cut once v2 is ready? *Recommendation: keep both during a
  deprecation window so the existing OpenClaw integrations don't break overnight.*
- [ ] **Ownership transfer & deletion**: what happens to a project when its sole
  owner is removed? *Open — likely block removal until a new owner is assigned.*
- [ ] **Default project on import**: name it `OpenClaw` or `Default`?
  *Open — minor.*
