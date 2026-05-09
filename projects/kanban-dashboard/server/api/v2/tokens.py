from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from server.auth import tokens as token_service
from server.config import get_settings
from server.db import get_db
from server.deps import get_current_user
from server.models.user import User
from server.schemas.token import (
    TokenCreatedResponse,
    TokenCreateRequest,
    TokenPublic,
)

router = APIRouter(prefix="/api/v2/tokens", tags=["tokens"])


def _require_session_cookie(request: Request) -> None:
    """Token creation only via cookie — never via another bearer.

    Prevents a stolen bearer from minting permanent siblings.
    """
    settings = get_settings()
    if not request.cookies.get(settings.session_cookie_name):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "unauthorized",
                    "message": "Tokens can only be created from a signed-in browser session.",
                }
            },
        )


@router.post("", response_model=TokenCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_token(
    body: TokenCreateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TokenCreatedResponse:
    _require_session_cookie(request)
    row, plaintext = token_service.create_token(db, user, body.name)
    return TokenCreatedResponse(
        id=row.id,
        name=row.name,
        prefix=row.prefix,
        created_at=row.created_at,
        last_used_at=row.last_used_at,
        revoked_at=row.revoked_at,
        plaintext=plaintext,
    )


@router.get("", response_model=list[TokenPublic])
def list_tokens(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TokenPublic]:
    rows = token_service.list_user_tokens(db, user.id)
    return [TokenPublic.model_validate(r) for r in rows]


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_token(
    token_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not token_service.revoke_token(db, token_id, user.id):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Token not found."}},
        )
