from __future__ import annotations

import base64
import json
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.db import get_db
from server.deps import get_project_member
from server.models.activity import ActivityEvent
from server.models.project import ProjectMember
from server.schemas.activity import ActivityListResponse, ActivityPublic

router = APIRouter(
    prefix="/api/v2/projects/{project_id}/activity",
    tags=["activity"],
)


def _encode_cursor(created_at: datetime, event_id: UUID) -> str:
    raw = json.dumps({"t": created_at.isoformat(), "i": str(event_id)})
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        data = json.loads(raw)
        return datetime.fromisoformat(data["t"]), UUID(data["i"])
    except (ValueError, KeyError) as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "validation_error", "message": "Invalid cursor."}},
        ) from exc


@router.get("", response_model=ActivityListResponse)
def list_activity(
    project_id: UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    membership: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
) -> ActivityListResponse:
    stmt = (
        select(ActivityEvent)
        .where(ActivityEvent.project_id == project_id)
        .order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
        .limit(limit + 1)
    )
    if cursor is not None:
        ts, eid = _decode_cursor(cursor)
        # tuple-comparison cursor: events strictly older than (ts, eid)
        stmt = stmt.where(
            (ActivityEvent.created_at < ts)
            | ((ActivityEvent.created_at == ts) & (ActivityEvent.id < eid))
        )

    rows = list(db.execute(stmt).scalars())
    next_cursor: str | None = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = _encode_cursor(last.created_at, last.id)
        rows = rows[:limit]
    items = [ActivityPublic.model_validate(r) for r in rows]
    return ActivityListResponse(items=items, next_cursor=next_cursor)
