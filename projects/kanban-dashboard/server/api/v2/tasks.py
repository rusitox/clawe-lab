from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from server.db import get_db
from server.deps import get_project_member, require_writer
from server.markdown import render as render_markdown
from server.models.project import ProjectMember
from server.models.task import (
    TASK_COLUMNS,
    TASK_KINDS,
    Task,
    TaskAssignee,
)
from server.schemas.task import (
    TaskCreate,
    TaskListResponse,
    TaskMove,
    TaskPublic,
    TaskUpdate,
    UnarchiveRequest,
)
from server.services import activity, ordering

logger = logging.getLogger("kanban")

router = APIRouter(
    prefix="/api/v2/projects/{project_id}/tasks",
    tags=["tasks"],
)


def _now() -> datetime:
    return datetime.now(UTC)


def _task_or_404(db: Session, project_id: UUID, task_id: UUID) -> Task:
    task = db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == project_id,
            Task.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Task not found."}},
        )
    return task


def _public(db: Session, task: Task) -> TaskPublic:
    assignees = list(
        db.execute(
            select(TaskAssignee.user_id).where(TaskAssignee.task_id == task.id)
        ).scalars()
    )
    return TaskPublic(
        id=task.id,
        project_id=task.project_id,
        kind=task.kind,
        column=task.column,
        position=task.position,
        priority=task.priority,
        team_id=task.team_id,
        title=task.title,
        description_md=task.description_md,
        description_html=task.description_html,
        labels=list(task.labels or []),
        created_by=task.created_by,
        assignees=assignees,
        created_at=task.created_at,
        updated_at=task.updated_at,
        archived_at=task.archived_at,
    )


def _set_assignees(db: Session, task_id: UUID, user_ids: list[UUID]) -> None:
    db.execute(delete(TaskAssignee).where(TaskAssignee.task_id == task_id))
    for uid in dict.fromkeys(user_ids):  # dedupe preserving order
        db.add(TaskAssignee(task_id=task_id, user_id=uid))
    db.flush()


def _parse_cursor(cursor: str) -> tuple[datetime, UUID]:
    """Parse cursor string of the form '{iso_datetime}_{uuid}'.

    Splits on the last underscore so the UUID (which contains hyphens, not
    underscores) is cleanly separated from the ISO datetime portion.
    """
    sep = cursor.rfind("_")
    if sep == -1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "validation_error", "message": "Invalid cursor format."}},
        )
    dt_str = cursor[:sep]
    id_str = cursor[sep + 1:]
    try:
        cursor_dt = datetime.fromisoformat(dt_str)
        cursor_id = UUID(id_str)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "validation_error", "message": "Invalid cursor format."}},
        ) from exc
    return cursor_dt, cursor_id


@router.get("", response_model=TaskListResponse)
def list_tasks(
    project_id: UUID,
    column: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    assignee: UUID | None = Query(default=None),
    label: str | None = Query(default=None),
    archived: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
    membership: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
) -> TaskListResponse:
    if archived and column is not None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "validation_error", "message": "cannot filter by column in archive view"}},
        )
    if column is not None and column not in TASK_COLUMNS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"error": {"code": "validation_error", "message": "Invalid column."}})
    if kind is not None and kind not in TASK_KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"error": {"code": "validation_error", "message": "Invalid kind."}})

    if archived:
        stmt = (
            select(Task)
            .where(Task.project_id == project_id, Task.deleted_at.is_(None), Task.archived_at.is_not(None))
            .order_by(Task.archived_at.desc(), Task.id.desc())
        )
        if cursor is not None:
            cursor_dt, cursor_id = _parse_cursor(cursor)
            stmt = stmt.where(
                (Task.archived_at < cursor_dt)
                | ((Task.archived_at == cursor_dt) & (Task.id < cursor_id))
            )
        if kind is not None:
            stmt = stmt.where(Task.kind == kind)
        if label is not None:
            stmt = stmt.where(Task.labels.contains([label]))
        if assignee is not None:
            stmt = stmt.join(TaskAssignee, TaskAssignee.task_id == Task.id).where(
                TaskAssignee.user_id == assignee
            )

        rows = list(db.execute(stmt.limit(limit + 1)).scalars().unique())
        next_cursor: str | None = None
        if len(rows) > limit:
            rows = rows[:limit]
            last = rows[-1]
            assert last.archived_at is not None
            next_cursor = f"{last.archived_at.isoformat()}_{last.id}"

        items = [_public(db, t) for t in rows]
        return TaskListResponse(items=items, next_cursor=next_cursor)

    # Default (active) board view — exclude archived tasks.
    stmt = (
        select(Task)
        .where(Task.project_id == project_id, Task.deleted_at.is_(None), Task.archived_at.is_(None))
        .order_by(Task.column.asc(), Task.position.asc())
    )
    if column is not None:
        stmt = stmt.where(Task.column == column)
    if kind is not None:
        stmt = stmt.where(Task.kind == kind)
    if label is not None:
        stmt = stmt.where(Task.labels.contains([label]))
    if assignee is not None:
        stmt = stmt.join(TaskAssignee, TaskAssignee.task_id == Task.id).where(
            TaskAssignee.user_id == assignee
        )

    tasks = list(db.execute(stmt).scalars().unique())
    items = [_public(db, t) for t in tasks]
    return TaskListResponse(items=items)


@router.post("", response_model=TaskPublic, status_code=status.HTTP_201_CREATED)
def create_task(
    project_id: UUID,
    body: TaskCreate,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> TaskPublic:
    if body.after_task_id is not None:
        position = ordering.position_between(
            db, project_id, body.column, after_task_id=body.after_task_id, before_task_id=None
        )
    else:
        position = ordering.position_for_bottom(db, project_id, body.column)

    task = Task(
        project_id=project_id,
        kind=body.kind,
        column=body.column,
        position=position,
        priority=body.priority,
        team_id=body.team_id,
        title=body.title,
        description_md=body.description_md,
        description_html=render_markdown(body.description_md),
        labels=list(body.labels),
        created_by=membership.user_id,
    )
    db.add(task)
    db.flush()
    if body.assignees:
        _set_assignees(db, task.id, body.assignees)
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="task.created",
        target_type="task",
        target_id=task.id,
        payload={"title": task.title, "kind": task.kind, "column": task.column},
    )
    db.commit()
    db.refresh(task)
    return _public(db, task)


@router.get("/{task_id}", response_model=TaskPublic)
def get_task(
    project_id: UUID,
    task_id: UUID,
    membership: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
) -> TaskPublic:
    task = _task_or_404(db, project_id, task_id)
    return _public(db, task)


@router.patch("/{task_id}", response_model=TaskPublic)
def update_task(
    project_id: UUID,
    task_id: UUID,
    body: TaskUpdate,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> TaskPublic:
    task = _task_or_404(db, project_id, task_id)
    changes: dict[str, object] = {}
    if body.title is not None:
        changes["title"] = body.title
        task.title = body.title
    if body.kind is not None:
        changes["kind"] = body.kind
        task.kind = body.kind
    if body.priority is not None:
        changes["priority"] = body.priority
        task.priority = body.priority
    if body.team_id is not None:
        task.team_id = body.team_id
    if body.description_md is not None:
        task.description_md = body.description_md
        task.description_html = render_markdown(body.description_md)
    if body.labels is not None:
        task.labels = list(body.labels)
    if body.assignees is not None:
        _set_assignees(db, task.id, body.assignees)
    task.updated_at = _now()
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="task.updated",
        target_type="task",
        target_id=task.id,
        payload=changes,
    )
    db.commit()
    db.refresh(task)
    return _public(db, task)


@router.post("/{task_id}/move", response_model=TaskPublic)
def move_task(
    project_id: UUID,
    task_id: UUID,
    body: TaskMove,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> TaskPublic:
    task = _task_or_404(db, project_id, task_id)
    prev = {"column": task.column, "position": task.position}
    new_pos = ordering.position_between(
        db,
        project_id,
        body.column,
        after_task_id=body.after_task_id,
        before_task_id=body.before_task_id,
    )
    task.column = body.column
    task.position = new_pos
    task.updated_at = _now()
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="task.moved",
        target_type="task",
        target_id=task.id,
        payload={"from": prev, "to": {"column": task.column, "position": task.position}},
    )
    db.commit()
    db.refresh(task)
    return _public(db, task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    project_id: UUID,
    task_id: UUID,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> None:
    task = _task_or_404(db, project_id, task_id)
    task.deleted_at = _now()
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="task.deleted",
        target_type="task",
        target_id=task.id,
    )
    db.commit()


@router.post("/{task_id}/archive", response_model=TaskPublic)
def archive_task(
    project_id: UUID,
    task_id: UUID,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> TaskPublic:
    """Archive a task (move it out of the active board).

    Requires owner or editor role. Returns 409 if the task is already archived.
    The task must not be soft-deleted.
    """
    task = _task_or_404(db, project_id, task_id)
    if task.archived_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"error": {"code": "conflict", "message": "Task is already archived."}},
        )
    now = _now()
    task.archived_at = now
    task.updated_at = now
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="task.archived",
        target_type="task",
        target_id=task.id,
        payload={"auto": False},
    )
    db.commit()
    db.refresh(task)
    return _public(db, task)


@router.post("/{task_id}/unarchive", response_model=TaskPublic)
def unarchive_task(
    project_id: UUID,
    task_id: UUID,
    body: UnarchiveRequest,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> TaskPublic:
    """Restore an archived task to an active column.

    Requires owner or editor role. Returns 409 if the task is not archived.
    The destination column must be one of the valid TASK_COLUMNS values.
    """
    task = _task_or_404(db, project_id, task_id)
    if task.archived_at is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"error": {"code": "conflict", "message": "Task is not archived."}},
        )
    now = _now()
    task.archived_at = None
    task.column = body.column
    task.updated_at = now
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="task.unarchived",
        target_type="task",
        target_id=task.id,
        payload={"restored_to": body.column},
    )
    db.commit()
    db.refresh(task)
    return _public(db, task)
