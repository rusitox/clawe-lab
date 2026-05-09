from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from server.config import get_settings
from server.models.session import Session as SessionRow
from server.models.user import User


def _now() -> datetime:
    return datetime.now(UTC)


def issue_session(db: DbSession, user: User, user_agent: str | None = None) -> SessionRow:
    settings = get_settings()
    sid = secrets.token_hex(32)
    now = _now()
    row = SessionRow(
        id=sid,
        user_id=user.id,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(seconds=settings.session_max_age_seconds),
        user_agent=(user_agent or "")[:512] or None,
    )
    db.add(row)
    db.commit()
    return row


def resolve_session(db: DbSession, session_id: str | None) -> tuple[SessionRow, User] | None:
    if not session_id:
        return None
    row = db.execute(
        select(SessionRow).where(SessionRow.id == session_id)
    ).scalar_one_or_none()
    if row is None:
        return None
    if row.expires_at <= _now():
        db.delete(row)
        db.commit()
        return None
    user = db.get(User, row.user_id)
    if user is None:
        return None
    row.last_seen_at = _now()
    user.last_seen_at = _now()
    db.commit()
    return row, user


def destroy_session(db: DbSession, session_id: str) -> None:
    row = db.get(SessionRow, session_id)
    if row is not None:
        db.delete(row)
        db.commit()
