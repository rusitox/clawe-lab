"""Dev/test-only auth bypass.

Enabled by setting `TEST_AUTH_BYPASS=true`. Disabled in production by an
explicit check at app startup. Emits a session cookie for any email passed
in `?email=...` so e2e tests don't have to drive a real OAuth flow.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from server.config import get_settings
from server.models.user import User


def is_enabled() -> bool:
    settings = get_settings()
    if settings.app_env == "production":
        return False
    return settings.test_auth_bypass


def upsert_user_by_email(db: Session, email: str, name: str | None = None) -> User:
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        user = User(
            google_sub=f"test-bypass-{email}",
            email=email,
            name=name or email.split("@")[0],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
