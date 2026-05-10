---
name: openclaw-kanban
description: How OpenClaw (or any non-browser client) authenticates and operates against the Clawe Kanban v2 API as a regular user — its own account, its own project, full read/write workflow.
type: skill
audience: openClaw runtime
api_version: v2
api_base: https://136-248-107-132.nip.io/api/v2
status: production
---

# OpenClaw ↔ Clawe Kanban v2 — integration skill

This document is the **single source of truth** for OpenClaw's interaction
with the Clawe Kanban dashboard. It tells you how to authenticate, how the
multi-tenant model works, what endpoints exist, what payloads look like,
and how to compose them into common workflows.

**Core idea:** OpenClaw is a first-class **user** of the kanban — it has its
own Google account (`clawe.bot@gmail.com`), its own per-user API token, and
its own membership in the projects it operates on. All requests flow through
the same v2 API a human user would use; there is **no admin/service bypass**.

---

## 1. Identity + first-time setup

**OpenClaw's account:** `clawe.bot@gmail.com` (already on `ALLOWED_EMAILS`).

API tokens are generated **only from a signed-in browser session** — a stolen
bearer cannot mint a sibling, by design (`server/api/v2/tokens.py`). So the
one-time bootstrap is:

1. Sign in once at https://136-248-107-132.nip.io with `clawe.bot@gmail.com`.
2. Create a project that OpenClaw will own (e.g., "OpenClaw Tasks").
3. Open `/settings/tokens` (or `Settings → API tokens`).
4. Click **Generate token** → name it (e.g., `openclaw-prod-2026`) → copy
   the plaintext value. **Shown once.** Format: `kbn_<43-char-base64url>`.
5. Store it in OpenClaw's secret store (env var `KANBAN_API_TOKEN` or equivalent).

If the token is ever leaked or rotated, repeat steps 3–5 and revoke the old
token in the UI. The token has the same permissions as the user — it is
NOT scoped to a single project.

### Token rotation (no downtime)

Generate a new token → update OpenClaw's config → restart → verify with
`GET /api/v2/me` → revoke the old token in the UI. Tokens are independent
(many can be live concurrently).

---

## 2. Authentication

Every request carries:

```
Authorization: Bearer kbn_<your-token>
```

**Verify the token works:**

```http
GET /api/v2/me
Authorization: Bearer kbn_<token>
```

Response (HTTP 200):
```json
{
  "id": "11111111-2222-3333-4444-555555555555",
  "email": "clawe.bot@gmail.com",
  "display_name": "OpenClaw Bot",
  "avatar_url": "https://lh3.googleusercontent.com/..."
}
```

Failure modes:
- HTTP 401 — token missing, malformed, or revoked
- HTTP 403 — token valid but trying to do a session-only action (e.g., `POST /api/v2/tokens`)
- HTTP 404 — bearers cannot mint sibling tokens; mint via browser session

---

## 3. Multi-tenant model

**Every tenant-owned resource is scoped by `project_id`.** OpenClaw must
know which project a given operation targets and pass that ID in the URL
(never as a query param).

URL convention: `/api/v2/projects/{project_id}/<resource>`

If OpenClaw is not a member of `project_id`, the API returns **404, not 403**.
This is intentional — non-members should not learn whether a project exists.

OpenClaw's recommended setup:
- One project for its own work (created during §1).
- Optionally invited as `member` (or `viewer`) to other projects to file
  bugs/proposals on behalf of users.

Check current memberships:

```http
GET /api/v2/projects
Authorization: Bearer kbn_<token>
```

Returns the list of projects OpenClaw is a member of (with role on each).

---

## 4. Resource catalog

Base URL throughout: `https://136-248-107-132.nip.io`

### 4.1 Me

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v2/me` | Verify auth + get own profile |

### 4.2 Projects

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v2/projects` | List projects OpenClaw is a member of |
| POST | `/api/v2/projects` | Create a new project (creator becomes owner) |
| GET | `/api/v2/projects/{project_id}` | Detail + member list + your role |
| PATCH | `/api/v2/projects/{project_id}` | Rename / change slug (owner only) |
| DELETE | `/api/v2/projects/{project_id}` | Soft-delete (owner only) |
| GET | `/api/v2/projects/{project_id}/members` | List members |
| POST | `/api/v2/projects/{project_id}/members` | Invite by email + role |
| PATCH | `/api/v2/projects/{project_id}/members/{user_id}` | Change role |
| DELETE | `/api/v2/projects/{project_id}/members/{user_id}` | Remove |

`ProjectCreate` body: `{ "name": "OpenClaw Tasks", "slug": "openclaw" }`
(slug optional — auto-derived from name).

### 4.3 Tasks (the kanban itself)

All paths nested under `/api/v2/projects/{project_id}`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/tasks` | List/filter tasks in the project |
| POST | `/tasks` | Create a task |
| GET | `/tasks/{task_id}` | Single task + comments + attachments |
| PATCH | `/tasks/{task_id}` | Update title, body, kind, priority, team |
| POST | `/tasks/{task_id}/move` | Move to another column or reorder |
| DELETE | `/tasks/{task_id}` | Soft-delete |

**Enums (validated server-side; bad value → HTTP 422):**

- `kind`: `"task"` | `"bug"` | `"proposal"`
- `column`: `"backlog"` | `"todo"` | `"inprogress"` | `"done"`
- `priority`: `"P0"` | `"P1"` | `"P2"` | `"P3"` | `null`

**Filter query params on `GET /tasks`:**
- `kind=bug,proposal` — comma-separated allow-list
- `column=todo,inprogress`
- `assignee_id=<uuid>` — tasks assigned to a member
- `team_id=<uuid>`
- `q=<text>` — full-text search title + body
- `limit=50&cursor=<opaque>` — pagination

`TaskCreate` body:
```json
{
  "title": "Investigar fallo de OAuth en sign-in",
  "kind": "bug",
  "column": "todo",
  "priority": "P1",
  "team_id": null,
  "description_md": "## Steps\n1. ...\n2. ...\n\n**Expected:** ...\n**Actual:** ..."
}
```

Only `title` is required. Omitted fields use defaults: `kind=task`,
`column=backlog`, `priority=null`.

`TaskMove` body:
```json
{ "column": "inprogress", "after_task_id": "<uuid-or-null>" }
```

`after_task_id=null` puts the task at the top of the destination column.

### 4.4 Comments (per task)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v2/projects/{project_id}/tasks/{task_id}/comments` | List comments |
| POST | `/api/v2/projects/{project_id}/tasks/{task_id}/comments` | Post comment |
| GET | `/api/v2/comments/{comment_id}` | Single comment (flat lookup) |
| PATCH | `/api/v2/comments/{comment_id}` | Edit (author only) |
| DELETE | `/api/v2/comments/{comment_id}` | Delete (author OR project owner) |

`CommentCreate` body: `{ "body_md": "Markdown text up to 20k chars" }`.
HTML in `body_md` is sanitized server-side. XSS attempts are stripped.

### 4.5 Attachments (per task)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v2/projects/{project_id}/tasks/{task_id}/attachments` | Upload (multipart/form-data, field `file`) |
| GET | `/api/v2/attachments/{attachment_id}` | Stream raw bytes |
| DELETE | `/api/v2/attachments/{attachment_id}` | Delete (uploader OR project owner) |

Limits:
- `ATTACHMENTS_MAX_BYTES=10485760` (10 MiB)
- Mime allow-list: images only (PNG, JPEG, WebP, GIF). Other types → HTTP 415.
- HTTP 413 → exceeded `client_max_body_size` at nginx level (12 MiB cap).

### 4.6 Teams (per project)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v2/projects/{project_id}/teams` | List teams |
| POST | `/api/v2/projects/{project_id}/teams` | Create (`name` + `color` hex) |
| PATCH | `/api/v2/projects/{project_id}/teams/{team_id}` | Update |
| DELETE | `/api/v2/projects/{project_id}/teams/{team_id}` | Delete |

`TeamCreate` body: `{ "name": "Engineering", "color": "#3b82f6" }`.

### 4.7 Activity feed

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v2/projects/{project_id}/activity` | List recent events (paginated) |

Use to react to other users' actions, audit changes, or build digest reports.
Each event has `kind` (e.g., `task.created`, `task.moved`, `comment.added`),
`actor_id`, `entity_id`, `entity_kind`, `created_at`, `payload` (JSON).

### 4.8 Tokens (own tokens only — session-required for create)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/tokens` | List own tokens (last_used_at, prefix, name) |
| POST | `/api/v2/tokens` | **Session-only**, NOT bearer. Returns plaintext once. |
| DELETE | `/api/v2/tokens/{token_id}` | Revoke (idempotent) |

OpenClaw should never need POST. List/revoke is fine via bearer.

---

## 5. Common workflows (recipes)

### 5.1 Boot check on startup

```bash
curl -fsS \
  -H "Authorization: Bearer $KANBAN_API_TOKEN" \
  https://136-248-107-132.nip.io/api/v2/me
```

Exit non-zero on 401/network error. Cache `id` for the session.

### 5.2 Get OpenClaw's project_id (one-time, cache it)

```bash
curl -sS \
  -H "Authorization: Bearer $KANBAN_API_TOKEN" \
  https://136-248-107-132.nip.io/api/v2/projects \
  | jq -r '.[] | select(.slug=="openclaw") | .id'
```

Store the resulting UUID as `KANBAN_PROJECT_ID`. Resync only if the project
is renamed or OpenClaw is invited to additional projects.

### 5.3 Create a task

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $KANBAN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Run nightly OAuth audit",
    "kind": "task",
    "column": "todo",
    "priority": "P2",
    "description_md": "Scheduled by OpenClaw at 2026-05-10T13:00Z"
  }' \
  "https://136-248-107-132.nip.io/api/v2/projects/$KANBAN_PROJECT_ID/tasks"
```

Response: full `TaskPublic` with `id`, `position`, etc. Cache the `id`.

### 5.4 Post a progress comment

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $KANBAN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "body_md": "Audit started.\n\n- 12 sessions checked\n- 0 anomalies" }' \
  "https://136-248-107-132.nip.io/api/v2/projects/$KANBAN_PROJECT_ID/tasks/$TASK_ID/comments"
```

### 5.5 Move task to "in progress" then "done"

```bash
# To inprogress
curl -sS -X POST \
  -H "Authorization: Bearer $KANBAN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "column": "inprogress", "after_task_id": null }' \
  "https://136-248-107-132.nip.io/api/v2/projects/$KANBAN_PROJECT_ID/tasks/$TASK_ID/move"

# To done after work completes
curl -sS -X POST \
  -H "Authorization: Bearer $KANBAN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "column": "done", "after_task_id": null }' \
  "https://136-248-107-132.nip.io/api/v2/projects/$KANBAN_PROJECT_ID/tasks/$TASK_ID/move"
```

### 5.6 Attach a screenshot/log

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $KANBAN_API_TOKEN" \
  -F "file=@/tmp/audit-report.png" \
  "https://136-248-107-132.nip.io/api/v2/projects/$KANBAN_PROJECT_ID/tasks/$TASK_ID/attachments"
```

Returns `AttachmentPublic` with the URL OpenClaw can render or share.

### 5.7 File a bug from a detected anomaly

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $KANBAN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "OAuth state expired in 3 sign-ins (last 1h)",
    "kind": "bug",
    "column": "todo",
    "priority": "P1",
    "description_md": "Detected by OpenClaw at <ISO-8601>.\n\n## Affected\n- session a1b2…\n- session c3d4…\n\n## Suspect\nClock skew between auth callback and DB."
  }' \
  "https://136-248-107-132.nip.io/api/v2/projects/$KANBAN_PROJECT_ID/tasks"
```

Then optionally attach the relevant log lines as a `.txt` (allowed mime — verify
locally — or re-render as a PNG snippet if the mime allow-list excludes text).

### 5.8 React to recent activity (poll loop)

```bash
SINCE=$(date -u -d '5 minutes ago' +%FT%TZ)
curl -sS \
  -H "Authorization: Bearer $KANBAN_API_TOKEN" \
  "https://136-248-107-132.nip.io/api/v2/projects/$KANBAN_PROJECT_ID/activity?since=$SINCE"
```

Iterate events; deduplicate by `id`; act on `kind` matches OpenClaw cares about
(e.g., `task.created` from another user that mentions OpenClaw in `description_md`).

---

## 6. Error model

All errors return JSON with this shape:

```json
{
  "detail": {
    "error": {
      "code": "<machine-readable>",
      "message": "<human-readable>",
      "field": "<optional, for validation errors>"
    }
  }
}
```

| HTTP | `code` | When | OpenClaw should… |
|---|---|---|---|
| 400 | `bad_request` | Malformed JSON, type mismatch | Log + give up (programmer error) |
| 401 | `unauthorized` | Missing/invalid Bearer | Refresh token from secrets, retry once, then alert |
| 403 | `forbidden` | Trying session-only action via bearer | Don't retry — change the call |
| 404 | `not_found` | Resource missing OR not a member | Verify project_id; re-check membership |
| 409 | `conflict` | Slug collision, last-owner removal, etc. | Surface to operator |
| 413 | `payload_too_large` | Attachment > nginx cap | Compress / split |
| 415 | `unsupported_media_type` | Attachment mime not on allow-list | Convert to PNG/JPEG |
| 422 | `validation_error` | Bad enum, missing required field | Read `field`, fix, retry |
| 429 | `rate_limited` | (future) | Back off |
| 503 | `service_unavailable` | DB down OR legacy v1 disabled | Retry with exponential backoff |

Network/timeout: treat as transient. Use ≤3 retries with backoff, then alert.

---

## 7. Constraints (do/don't)

**DO:**
- Always pass `Authorization: Bearer ...` — every endpoint requires it.
- Cache `project_id` after first lookup; only refetch on project rename or new invite.
- Use `description_md` for rich content; the server sanitizes it safely.
- Set `priority` deliberately — `P0` should be reserved for service-impacting issues.
- Log the response `id` of every created resource so OpenClaw can update/delete later.
- Treat 404 on a project ID as "OpenClaw was removed as a member" — don't auto-retry.

**DON'T:**
- Don't try to mint API tokens via bearer (HTTP 403 by design; § 4.8).
- Don't pass `project_id` as a query param; it's always part of the path.
- Don't poll `/api/v2/projects/<id>/activity` faster than every 30 s — it's a DB-backed feed.
- Don't expect `403` for cross-tenant access — the gate returns `404` to avoid leaking project existence.
- Don't store the plaintext token in logs, env dumps, or task descriptions.
- Don't use the legacy `/api/{tasks,activity,teams}` endpoints — currently returns 503 (`LEGACY_KANBAN_TOKEN` empty in production).

---

## 8. Reference

| Item | Where |
|---|---|
| Live URL | https://136-248-107-132.nip.io |
| API base | https://136-248-107-132.nip.io/api/v2 |
| OpenAPI/Swagger | https://136-248-107-132.nip.io/docs (interactive) and `/openapi.json` (raw spec) |
| Source of truth (design) | `projects/kanban-dashboard/specs/sdd-kanban-v2.md` |
| Operational runbook | `projects/kanban-dashboard/docs/ops.md` |
| CI/CD architecture | `projects/kanban-dashboard/docs/ci-cd.md` |
| Multi-tenant gate test | `projects/kanban-dashboard/tests/test_isolation_gate.py` |
| OpenClaw account | `clawe.bot@gmail.com` (whitelisted in `deploy/env.production`) |

If something in this skill drifts from runtime behavior, the **OpenAPI spec
at `/openapi.json`** is authoritative — fetch it and reconcile.
