"""Fractional position helpers for the kanban column ordering.

A task's position is a `DOUBLE PRECISION` so neighbours can be split with
`(prev + next) / 2`. New tasks at top of column get position = min - 1.0.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from server.models.task import Task

DEFAULT_STEP = 1.0
TOP_GUARD = 0.0


def position_for_top(db: Session, project_id: UUID, column: str) -> float:
    current_min = db.execute(
        select(func.min(Task.position)).where(
            Task.project_id == project_id,
            Task.column == column,
            Task.deleted_at.is_(None),
        )
    ).scalar()
    if current_min is None:
        return TOP_GUARD
    return current_min - DEFAULT_STEP


def position_for_bottom(db: Session, project_id: UUID, column: str) -> float:
    current_max = db.execute(
        select(func.max(Task.position)).where(
            Task.project_id == project_id,
            Task.column == column,
            Task.deleted_at.is_(None),
        )
    ).scalar()
    if current_max is None:
        return TOP_GUARD
    return current_max + DEFAULT_STEP


def position_between(
    db: Session,
    project_id: UUID,
    column: str,
    *,
    after_task_id: UUID | None,
    before_task_id: UUID | None,
) -> float:
    """Compute the new position to insert between two anchors.

    - If both anchors are None: append to bottom.
    - If only `after_task_id` is set: place after that task (before its current next).
    - If only `before_task_id` is set: place before that task.
    """
    if after_task_id is None and before_task_id is None:
        return position_for_bottom(db, project_id, column)

    after_pos = None
    before_pos = None
    if after_task_id is not None:
        after_pos = db.execute(
            select(Task.position).where(
                Task.id == after_task_id,
                Task.project_id == project_id,
                Task.column == column,
                Task.deleted_at.is_(None),
            )
        ).scalar()
    if before_task_id is not None:
        before_pos = db.execute(
            select(Task.position).where(
                Task.id == before_task_id,
                Task.project_id == project_id,
                Task.column == column,
                Task.deleted_at.is_(None),
            )
        ).scalar()

    if after_pos is not None and before_pos is None:
        next_pos = db.execute(
            select(func.min(Task.position)).where(
                Task.project_id == project_id,
                Task.column == column,
                Task.position > after_pos,
                Task.deleted_at.is_(None),
            )
        ).scalar()
        if next_pos is None:
            return after_pos + DEFAULT_STEP
        return (after_pos + next_pos) / 2.0

    if before_pos is not None and after_pos is None:
        prev_pos = db.execute(
            select(func.max(Task.position)).where(
                Task.project_id == project_id,
                Task.column == column,
                Task.position < before_pos,
                Task.deleted_at.is_(None),
            )
        ).scalar()
        if prev_pos is None:
            return before_pos - DEFAULT_STEP
        return (prev_pos + before_pos) / 2.0

    if after_pos is not None and before_pos is not None:
        return (after_pos + before_pos) / 2.0

    return position_for_bottom(db, project_id, column)
