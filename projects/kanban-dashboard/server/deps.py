"""FastAPI dependencies — auth + multi-tenant gate.

The multi-tenant gate (see SDD §4 A9) is a single dependency
`get_project_member` that EVERY project-scoped route MUST depend on. It
returns 404 (never 403) on a non-member to avoid revealing existence.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.auth import sessions, tokens
from server.config import get_settings
from server.db import get_db
from server.models.project import ProjectMember
from server.models.user import User


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Resolve the current user via session cookie OR bearer token."""
    settings = get_settings()

    sid = request.cookies.get(settings.session_cookie_name)
    if sid:
        resolved = sessions.resolve_session(db, sid)
        if resolved is not None:
            return resolved[1]

    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        plaintext = auth.split(" ", 1)[1].strip()
        user = tokens.verify_bearer(db, plaintext)
        if user is not None:
            return user

    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": "unauthenticated", "message": "Sign in to continue."}},
    )


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    try:
        return get_current_user(request=request, db=db)
    except HTTPException:
        return None


def get_project_member(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectMember:
    """The multi-tenant gate. Returns 404 (not 403) for non-members.

    Use as the sole dependency for every `/api/v2/projects/{project_id}/...` route.
    """
    membership = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user.id
        )
    ).scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Project not found."}},
        )
    return membership


def require_writer(
    membership: ProjectMember = Depends(get_project_member),
) -> ProjectMember:
    if not membership.can_write():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "unauthorized", "message": "Viewers cannot modify this project."}},
        )
    return membership


def require_owner(
    membership: ProjectMember = Depends(get_project_member),
) -> ProjectMember:
    if not membership.is_owner():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "unauthorized", "message": "Only project owners can do this."}},
        )
    return membership
