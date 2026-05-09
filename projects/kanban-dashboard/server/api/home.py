"""HTML home routes — render the project list when authed, redirect to /login otherwise."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.db import get_db
from server.deps import get_optional_user
from server.models.project import Project, ProjectMember
from server.models.user import User

router = APIRouter()
templates = Jinja2Templates(directory="server/templates")


def _initials(user: User) -> str:
    source = (user.name or user.email or "?").strip()
    parts = [p for p in source.replace("@", " ").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def _resolve_membership(
    db: Session, slug: str, user: User
) -> tuple[Project, ProjectMember]:
    row = db.execute(
        select(Project, ProjectMember)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            Project.slug == slug,
            ProjectMember.user_id == user.id,
            Project.deleted_at.is_(None),
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Project not found."}},
        )
    return row[0], row[1]


@router.get("/", response_class=HTMLResponse)
def home(
    request: Request,
    user: User | None = Depends(get_optional_user),
) -> Response:
    if user is None:
        return RedirectResponse("/login", status_code=302)
    return templates.TemplateResponse(
        request,
        "projects.html",
        {"user_initials": _initials(user)},
    )


@router.get("/p/{slug}", response_class=HTMLResponse)
def project_board(
    request: Request,
    slug: str,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> Response:
    if user is None:
        return RedirectResponse(f"/login?next=/p/{slug}", status_code=302)
    project, _ = _resolve_membership(db, slug, user)
    return templates.TemplateResponse(
        request,
        "board.html",
        {
            "user_initials": _initials(user),
            "project": {"id": str(project.id), "slug": project.slug, "name": project.name},
        },
    )


@router.get("/p/{slug}/members", response_class=HTMLResponse)
def project_members(
    request: Request,
    slug: str,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> Response:
    if user is None:
        return RedirectResponse(f"/login?next=/p/{slug}/members", status_code=302)
    project, membership = _resolve_membership(db, slug, user)
    return templates.TemplateResponse(
        request,
        "members.html",
        {
            "user_initials": _initials(user),
            "project": {"id": str(project.id), "slug": project.slug, "name": project.name},
            "your_role": membership.role,
            "your_user_id": str(user.id),
        },
    )


@router.get("/settings/tokens", response_class=HTMLResponse)
def tokens_page(
    request: Request,
    user: User | None = Depends(get_optional_user),
) -> Response:
    if user is None:
        return RedirectResponse("/login?next=/settings/tokens", status_code=302)
    return templates.TemplateResponse(
        request,
        "tokens.html",
        {"user_initials": _initials(user)},
    )
