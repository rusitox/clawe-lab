from __future__ import annotations

import secrets
from datetime import UTC, datetime
from uuid import UUID

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.models.api_token import ApiToken
from server.models.user import User

TOKEN_PREFIX = "kbn_"
TOKEN_BYTES = 32

_hasher = PasswordHasher()


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_plaintext() -> str:
    return TOKEN_PREFIX + secrets.token_urlsafe(TOKEN_BYTES)


def create_token(db: Session, user: User, name: str) -> tuple[ApiToken, str]:
    """Create a new API token. Returns (row, plaintext)."""
    plaintext = _generate_plaintext()
    row = ApiToken(
        user_id=user.id,
        name=name.strip(),
        token_hash=_hasher.hash(plaintext),
        prefix=plaintext[: len(TOKEN_PREFIX) + 8],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, plaintext


def list_user_tokens(db: Session, user_id: UUID) -> list[ApiToken]:
    return list(
        db.execute(
            select(ApiToken).where(ApiToken.user_id == user_id).order_by(ApiToken.created_at.desc())
        ).scalars()
    )


def revoke_token(db: Session, token_id: UUID, user_id: UUID) -> bool:
    row = db.execute(
        select(ApiToken).where(ApiToken.id == token_id, ApiToken.user_id == user_id)
    ).scalar_one_or_none()
    if row is None or row.revoked_at is not None:
        return False
    row.revoked_at = _now()
    db.commit()
    return True


def verify_bearer(db: Session, plaintext: str) -> User | None:
    """Resolve a bearer token to its user. Updates last_used_at on success."""
    if not plaintext or not plaintext.startswith(TOKEN_PREFIX):
        return None
    prefix = plaintext[: len(TOKEN_PREFIX) + 8]
    candidates = list(
        db.execute(
            select(ApiToken).where(ApiToken.prefix == prefix, ApiToken.revoked_at.is_(None))
        ).scalars()
    )
    for row in candidates:
        try:
            _hasher.verify(row.token_hash, plaintext)
        except VerifyMismatchError:
            continue
        row.last_used_at = _now()
        user = db.get(User, row.user_id)
        if user is None:
            continue
        db.commit()
        return user
    return None
