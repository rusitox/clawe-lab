"""Internal archive-done endpoint — not exposed in public OpenAPI docs.

POST /api/v2/internal/archive-done
Auth: Authorization: Bearer {INTERNAL_SECRET}

Scans all projects with auto_archive_days > 0 and archives eligible Done tasks
(non-deleted, non-archived, updated_at older than the threshold). Emits one
task.archived activity event per task with payload={"auto": true}. Commits
per project for isolation. Returns {"archived": N}.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from server.config import Settings, get_settings
from server.db import get_db
from server.models.project import Project
from server.models.task import Task
from server.services import activity

logger = logging.getLogger("kanban")

router = APIRouter(prefix="/api/v2/internal", tags=["internal"])


def _check_internal_secret(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    """Validate the Bearer token against INTERNAL_SECRET.

    Rejects requests unconditionally if the secret is not configured (empty
    string), so an uninitialized environment cannot accidentally grant access.
    """
    if not settings.internal_secret:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "unauthorized", "message": "Internal secret not configured."}},
        )
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "unauthorized", "message": "Missing or malformed Authorization header."}},
        )
    token = authorization[len("Bearer "):]
    if token != settings.internal_secret:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "unauthorized", "message": "Invalid internal secret."}},
        )


@router.post(
    "/archive-done",
    include_in_schema=False,
    dependencies=[Depends(_check_internal_secret)],
)
def archive_done(
    db: Session = Depends(get_db),
) -> dict[str, int]:
    """Auto-archive Done tasks that have exceeded the project's threshold.

    For each project with auto_archive_days > 0 and no deleted_at, finds all
    tasks in the 'done' column that are non-deleted, non-archived, and whose
    updated_at is older than auto_archive_days days. Sets archived_at and
    updated_at to now(), emits task.archived activity events, and commits.

    Idempotent: tasks already archived are skipped by the archived_at IS NULL
    filter.
    """
    now = datetime.now(UTC)
    total_archived = 0

    projects = list(
        db.execute(
            select(Project).where(
                Project.auto_archive_days.is_not(None),
                Project.auto_archive_days > 0,
                Project.deleted_at.is_(None),
            )
        ).scalars()
    )

    for project in projects:
        assert project.auto_archive_days is not None
        threshold = now - timedelta(days=project.auto_archive_days)

        # Fetch the eligible task IDs before updating so we can emit events.
        eligible_tasks: list[Task] = list(
            db.execute(
                select(Task).where(
                    Task.project_id == project.id,
                    Task.column == "done",
                    Task.deleted_at.is_(None),
                    Task.archived_at.is_(None),
                    Task.updated_at < threshold,
                )
            ).scalars()
        )

        if not eligible_tasks:
            continue

        eligible_ids: list[UUID] = [t.id for t in eligible_tasks]

        # Bulk update archived_at and updated_at.
        db.execute(
            update(Task)
            .where(Task.id.in_(eligible_ids))
            .values(archived_at=now, updated_at=now)
        )

        # Emit one activity event per archived task.
        for task in eligible_tasks:
            activity.emit(
                db,
                project_id=project.id,
                user_id=None,
                kind="task.archived",
                target_type="task",
                target_id=task.id,
                payload={"auto": True},
            )

        n = len(eligible_tasks)
        db.commit()
        total_archived += n
        logger.info("auto-archive: project %s archived %d tasks", project.id, n)

    return {"archived": total_archived}
