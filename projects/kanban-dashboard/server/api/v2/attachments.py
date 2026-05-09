from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.config import get_settings
from server.db import get_db
from server.deps import get_current_user, get_project_member, require_writer
from server.models.attachment import Attachment
from server.models.project import ProjectMember
from server.models.task import Task
from server.models.user import User
from server.schemas.attachment import AttachmentPublic
from server.services import activity
from server.storage import get_default_storage
from server.storage.base import FileTooLargeError

ALLOWED_MIME_PREFIXES = ("image/", "text/", "application/pdf", "application/json", "application/zip")

per_task_router = APIRouter(
    prefix="/api/v2/projects/{project_id}/tasks/{task_id}/attachments",
    tags=["attachments"],
)
flat_router = APIRouter(prefix="/api/v2/attachments", tags=["attachments"])


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


def _attachment_for_member(
    db: Session, attachment_id: UUID, user: User
) -> tuple[Attachment, ProjectMember]:
    """Resolve an attachment and the requesting user's membership in its project.

    Returns 404 if the attachment doesn't exist OR the user is not a member of
    the owning project (multi-tenant isolation: never reveal existence).
    """
    row = db.execute(
        select(Attachment, ProjectMember)
        .join(
            ProjectMember,
            (ProjectMember.project_id == Attachment.project_id)
            & (ProjectMember.user_id == user.id),
        )
        .where(Attachment.id == attachment_id, Attachment.deleted_at.is_(None))
    ).one_or_none()
    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Attachment not found."}},
        )
    attachment, membership = row
    return attachment, membership


def _check_mime(mime: str) -> None:
    for prefix in ALLOWED_MIME_PREFIXES:
        if mime.startswith(prefix):
            return
    raise HTTPException(
        status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail={
            "error": {
                "code": "validation_error",
                "message": f"MIME type '{mime}' is not allowed.",
            }
        },
    )


@per_task_router.post(
    "",
    response_model=AttachmentPublic,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    project_id: UUID,
    task_id: UUID,
    file: UploadFile,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> AttachmentPublic:
    settings = get_settings()
    task = _task_or_404(db, project_id, task_id)

    mime = file.content_type or "application/octet-stream"
    _check_mime(mime)

    try:
        stored = get_default_storage().store(
            fileobj=file.file, max_bytes=settings.attachments_max_bytes
        )
    except FileTooLargeError as exc:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            detail={
                "error": {
                    "code": "validation_error",
                    "message": f"File exceeds the {settings.attachments_max_bytes}-byte limit.",
                }
            },
        ) from exc

    row = Attachment(
        task_id=task.id,
        project_id=task.project_id,
        original_name=(file.filename or "upload")[:255],
        mime=mime,
        size_bytes=stored.size_bytes,
        storage_key=stored.storage_key,
        uploaded_by=membership.user_id,
    )
    db.add(row)
    db.flush()
    activity.emit(
        db,
        project_id=task.project_id,
        user_id=membership.user_id,
        kind="attachment.uploaded",
        target_type="attachment",
        target_id=row.id,
        payload={"task_id": str(task.id), "name": row.original_name, "size": row.size_bytes},
    )
    db.commit()
    db.refresh(row)
    return AttachmentPublic.model_validate(row)


@per_task_router.get("", response_model=list[AttachmentPublic])
def list_task_attachments(
    project_id: UUID,
    task_id: UUID,
    membership: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
) -> list[AttachmentPublic]:
    task = _task_or_404(db, project_id, task_id)
    rows = list(
        db.execute(
            select(Attachment)
            .where(Attachment.task_id == task.id, Attachment.deleted_at.is_(None))
            .order_by(Attachment.created_at.asc())
        ).scalars()
    )
    return [AttachmentPublic.model_validate(r) for r in rows]


@flat_router.get("/{attachment_id}", response_model=AttachmentPublic)
def get_attachment(
    attachment_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AttachmentPublic:
    row, _ = _attachment_for_member(db, attachment_id, user)
    return AttachmentPublic.model_validate(row)


@flat_router.get("/{attachment_id}/raw")
def stream_attachment(
    attachment_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    row, _ = _attachment_for_member(db, attachment_id, user)
    headers = {
        "Content-Disposition": f'inline; filename="{row.original_name}"',
        "Content-Length": str(row.size_bytes),
        "X-Content-Type-Options": "nosniff",
    }
    return StreamingResponse(
        get_default_storage().open_stream(row.storage_key),
        media_type=row.mime,
        headers=headers,
    )


@flat_router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    row, membership = _attachment_for_member(db, attachment_id, user)
    if not membership.can_write():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "unauthorized", "message": "Viewers cannot delete attachments."}},
        )
    row.deleted_at = _now()
    activity.emit(
        db,
        project_id=row.project_id,
        user_id=user.id,
        kind="attachment.deleted",
        target_type="attachment",
        target_id=row.id,
        payload={"task_id": str(row.task_id), "name": row.original_name},
    )
    db.commit()
