from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.db import get_db
from server.deps import get_current_user, get_project_member, require_writer
from server.markdown import render as render_markdown
from server.models.comment import Comment
from server.models.project import ProjectMember
from server.models.task import Task
from server.models.user import User
from server.schemas.comment import CommentCreate, CommentPublic, CommentUpdate
from server.services import activity

per_task_router = APIRouter(
    prefix="/api/v2/projects/{project_id}/tasks/{task_id}/comments",
    tags=["comments"],
)
flat_router = APIRouter(prefix="/api/v2/comments", tags=["comments"])


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


def _comment_for_member(
    db: Session, comment_id: UUID, user: User
) -> tuple[Comment, ProjectMember]:
    row = db.execute(
        select(Comment, ProjectMember)
        .join(
            ProjectMember,
            (ProjectMember.project_id == Comment.project_id)
            & (ProjectMember.user_id == user.id),
        )
        .where(Comment.id == comment_id, Comment.deleted_at.is_(None))
    ).one_or_none()
    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Comment not found."}},
        )
    return row[0], row[1]


@per_task_router.get("", response_model=list[CommentPublic])
def list_comments(
    project_id: UUID,
    task_id: UUID,
    membership: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
) -> list[CommentPublic]:
    task = _task_or_404(db, project_id, task_id)
    rows = list(
        db.execute(
            select(Comment)
            .where(Comment.task_id == task.id, Comment.deleted_at.is_(None))
            .order_by(Comment.created_at.asc())
        ).scalars()
    )
    return [CommentPublic.model_validate(r) for r in rows]


@per_task_router.post(
    "",
    response_model=CommentPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    project_id: UUID,
    task_id: UUID,
    body: CommentCreate,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> CommentPublic:
    task = _task_or_404(db, project_id, task_id)
    row = Comment(
        task_id=task.id,
        project_id=task.project_id,
        user_id=membership.user_id,
        body_md=body.body_md,
        body_html=render_markdown(body.body_md),
    )
    db.add(row)
    db.flush()
    activity.emit(
        db,
        project_id=task.project_id,
        user_id=membership.user_id,
        kind="comment.created",
        target_type="comment",
        target_id=row.id,
        payload={"task_id": str(task.id)},
    )
    db.commit()
    db.refresh(row)
    return CommentPublic.model_validate(row)


@flat_router.patch("/{comment_id}", response_model=CommentPublic)
def update_comment(
    comment_id: UUID,
    body: CommentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentPublic:
    row, _ = _comment_for_member(db, comment_id, user)
    if row.user_id != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "error": {"code": "unauthorized", "message": "Only the author can edit a comment."}
            },
        )
    row.body_md = body.body_md
    row.body_html = render_markdown(body.body_md)
    row.updated_at = _now()
    activity.emit(
        db,
        project_id=row.project_id,
        user_id=user.id,
        kind="comment.updated",
        target_type="comment",
        target_id=row.id,
        payload={"task_id": str(row.task_id)},
    )
    db.commit()
    db.refresh(row)
    return CommentPublic.model_validate(row)


@flat_router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Author or project owner may delete."""
    row, membership = _comment_for_member(db, comment_id, user)
    if row.user_id != user.id and not membership.is_owner():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "unauthorized", "message": "Only the author or a project owner can delete this comment."}},
        )
    row.deleted_at = _now()
    activity.emit(
        db,
        project_id=row.project_id,
        user_id=user.id,
        kind="comment.deleted",
        target_type="comment",
        target_id=row.id,
        payload={"task_id": str(row.task_id)},
    )
    db.commit()
