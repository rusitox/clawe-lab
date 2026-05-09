"""Activity event emitter — central place for writing audit / feed events.

Every project / task mutation that should appear in the activity feed calls
`emit` with a structured payload.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from server.models.activity import ActivityEvent


def emit(
    db: Session,
    *,
    project_id: UUID,
    user_id: UUID | None,
    kind: str,
    target_type: str,
    target_id: UUID | None = None,
    payload: dict[str, Any] | None = None,
) -> ActivityEvent:
    row = ActivityEvent(
        project_id=project_id,
        user_id=user_id,
        kind=kind,
        target_type=target_type,
        target_id=target_id,
        payload=payload or {},
    )
    db.add(row)
    db.flush()
    return row
