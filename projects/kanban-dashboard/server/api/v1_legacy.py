"""Legacy v1 router — soft cut (SDD §4 A10 + §5 Phase 6).

Hosts the original v1 surface (`/api/tasks`, `/api/activity`, `/api/teams`) so
existing OpenClaw scripts keep working during the v2 migration. Mapped to the
default project (`LEGACY_DEFAULT_PROJECT_SLUG`, default "clawe-hq") and gated
by the shared `LEGACY_KANBAN_TOKEN` env var.

Every response carries `Deprecation: true` and `Sunset: <date>` headers.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.config import get_settings
from server.db import get_db
from server.models.activity import ActivityEvent
from server.models.project import Project
from server.models.task import Task
from server.models.team import Team

router = APIRouter(prefix="/api", tags=["v1-legacy"])

LEGACY_DEFAULT_PROJECT_SLUG = "clawe-hq"
SUNSET_DATE = "2026-09-30"
_DEPRECATION_HEADERS = {
    "Deprecation": "true",
    "Sunset": SUNSET_DATE,
    "Link": '</api/v2/projects>; rel="successor-version"',
}


def _now() -> datetime:
    return datetime.now(UTC)


def _legacy_columns(raw: str) -> str:
    return {"in-progress": "inprogress", "inprogress": "inprogress"}.get(raw.lower(), raw.lower())


def _back_to_v1_column(col: str) -> str:
    return {"inprogress": "inprogress"}.get(col, col)


def _decorate_response(response: Response) -> None:
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = SUNSET_DATE
    response.headers["Link"] = '</api/v2/projects>; rel="successor-version"'


def require_legacy_token(
    response: Response,
    x_kanban_token: str | None = Header(default=None, alias="X-Kanban-Token"),
) -> None:
    """Auth gate for legacy endpoints. Token is the shared LEGACY_KANBAN_TOKEN.

    The decorate-response side effect runs unconditionally so even 401s carry the
    Deprecation/Sunset headers — clients can detect the impending sunset before
    they fix their auth.
    """
    _decorate_response(response)
    settings = get_settings()
    expected = settings.legacy_kanban_token.strip()
    if not expected:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "service_unavailable",
                    "message": "Legacy v1 API disabled (LEGACY_KANBAN_TOKEN not set).",
                }
            },
            headers=_DEPRECATION_HEADERS,
        )
    if not x_kanban_token or x_kanban_token.strip() != expected:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "unauthenticated", "message": "Missing or invalid X-Kanban-Token."}},
            headers=_DEPRECATION_HEADERS,
        )


def _project_or_503(db: Session) -> Project:
    project = db.execute(
        select(Project).where(
            Project.slug == LEGACY_DEFAULT_PROJECT_SLUG, Project.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "service_unavailable",
                    "message": (
                        f"Legacy default project '{LEGACY_DEFAULT_PROJECT_SLUG}' not found. "
                        "Run scripts/import_v1.py first."
                    ),
                }
            },
            headers=_DEPRECATION_HEADERS,
        )
    return project


@router.get("/tasks", dependencies=[Depends(require_legacy_token)])
def legacy_list_tasks(db: Session = Depends(get_db)) -> dict[str, Any]:
    project = _project_or_503(db)
    rows = list(
        db.execute(
            select(Task)
            .where(Task.project_id == project.id, Task.deleted_at.is_(None))
            .order_by(Task.column.asc(), Task.position.asc())
        ).scalars()
    )
    return {
        "version": 1,
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "desc": t.description_md,
                "col": _back_to_v1_column(t.column),
                "prio": t.priority or "P3",
                "createdAt": int(t.created_at.timestamp() * 1000),
                "updatedAt": int(t.updated_at.timestamp() * 1000),
            }
            for t in rows
        ],
    }


@router.get("/teams", dependencies=[Depends(require_legacy_token)])
def legacy_list_teams(db: Session = Depends(get_db)) -> dict[str, Any]:
    project = _project_or_503(db)
    rows = list(
        db.execute(select(Team).where(Team.project_id == project.id)).scalars()
    )
    return {
        "version": 1,
        "teams": {t.name: {"color": t.color} for t in rows},
    }


@router.get("/activity", dependencies=[Depends(require_legacy_token)])
def legacy_list_activity(db: Session = Depends(get_db)) -> dict[str, Any]:
    project = _project_or_503(db)
    rows = list(
        db.execute(
            select(ActivityEvent)
            .where(ActivityEvent.project_id == project.id)
            .order_by(ActivityEvent.created_at.desc())
            .limit(500)
        ).scalars()
    )
    return {
        "version": 1,
        "events": [
            {
                "ts": int(e.created_at.timestamp() * 1000),
                "agent": (e.payload or {}).get("agent", "system") if isinstance(e.payload, dict) else "system",
                "type": (e.payload or {}).get("type", "info") if isinstance(e.payload, dict) else "info",
                "text": (e.payload or {}).get("text", e.kind) if isinstance(e.payload, dict) else e.kind,
            }
            for e in rows
        ],
    }


@router.api_route("/tasks", methods=["PUT", "POST"], include_in_schema=False)
def legacy_write_blocked(request: Request, response: Response) -> dict[str, Any]:
    """Legacy v1 writes are blocked under the soft cut.

    During the migration window v1 is read-only — all writes must go through
    `/api/v2/*`. This keeps OpenClaw scripts that *only read* the dashboard
    working, while forcing write callers to upgrade.
    """
    _decorate_response(response)
    raise HTTPException(
        status.HTTP_410_GONE,
        detail={
            "error": {
                "code": "gone",
                "message": (
                    "v1 writes are no longer accepted. Use POST /api/v2/projects/"
                    "{project_id}/tasks instead."
                ),
            }
        },
        headers=_DEPRECATION_HEADERS,
    )
