from __future__ import annotations

from fastapi import APIRouter, Depends

from server.deps import get_current_user
from server.models.user import User
from server.schemas.user import MeResponse

router = APIRouter(prefix="/api/v2", tags=["me"])


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)) -> User:
    return user
