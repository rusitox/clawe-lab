from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from server.db import get_db
from server.deps import get_current_user, get_project_member, require_owner
from server.models.project import Project, ProjectMember
from server.models.user import User
from server.schemas.project import (
    MemberInvite,
    MemberPublic,
    MemberRoleUpdate,
    ProjectCreate,
    ProjectDetail,
    ProjectPublic,
    ProjectUpdate,
)
from server.services import activity

router = APIRouter(prefix="/api/v2/projects", tags=["projects"])


def _now() -> datetime:
    return datetime.now(UTC)


def _project_or_404(db: Session, project_id: UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Project not found."}},
        )
    return project


def _members_payload(db: Session, project_id: UUID) -> list[MemberPublic]:
    rows = list(
        db.execute(
            select(ProjectMember, User)
            .join(User, User.id == ProjectMember.user_id)
            .where(ProjectMember.project_id == project_id)
            .order_by(ProjectMember.created_at.asc())
        ).all()
    )
    return [
        MemberPublic(
            user_id=u.id,
            email=u.email,
            name=u.name,
            avatar_url=u.avatar_url,
            role=m.role,
        )
        for m, u in rows
    ]


def _count_owners(db: Session, project_id: UUID) -> int:
    n = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.role == "owner"
        )
    ).all()
    return len(n)


@router.get("", response_model=list[ProjectPublic])
def list_projects(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Project]:
    rows = db.execute(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == user.id, Project.deleted_at.is_(None))
        .order_by(Project.updated_at.desc())
    ).scalars()
    return list(rows)


@router.post("", response_model=ProjectPublic, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    project = Project(slug=body.resolve_slug(), name=body.name, created_by=user.id)
    db.add(project)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"error": {"code": "conflict", "message": "Slug already in use."}},
        ) from exc
    db.add(ProjectMember(project_id=project.id, user_id=user.id, role="owner"))
    activity.emit(
        db,
        project_id=project.id,
        user_id=user.id,
        kind="project.created",
        target_type="project",
        target_id=project.id,
        payload={"name": project.name, "slug": project.slug},
    )
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: UUID,
    membership: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
) -> ProjectDetail:
    project = _project_or_404(db, project_id)
    return ProjectDetail(
        id=project.id,
        slug=project.slug,
        name=project.name,
        created_at=project.created_at,
        updated_at=project.updated_at,
        members=_members_payload(db, project.id),
        your_role=membership.role,
    )


@router.patch("/{project_id}", response_model=ProjectPublic)
def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    membership: ProjectMember = Depends(require_owner),
    db: Session = Depends(get_db),
) -> Project:
    project = _project_or_404(db, project_id)
    if body.name is not None:
        project.name = body.name
    project.updated_at = _now()
    activity.emit(
        db,
        project_id=project.id,
        user_id=membership.user_id,
        kind="project.updated",
        target_type="project",
        target_id=project.id,
        payload={"name": project.name},
    )
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    membership: ProjectMember = Depends(require_owner),
    db: Session = Depends(get_db),
) -> None:
    project = _project_or_404(db, project_id)
    project.deleted_at = _now()
    activity.emit(
        db,
        project_id=project.id,
        user_id=membership.user_id,
        kind="project.deleted",
        target_type="project",
        target_id=project.id,
    )
    db.commit()


@router.get("/{project_id}/members", response_model=list[MemberPublic])
def list_members(
    project_id: UUID,
    membership: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
) -> list[MemberPublic]:
    return _members_payload(db, project_id)


@router.post(
    "/{project_id}/members",
    response_model=MemberPublic,
    status_code=status.HTTP_201_CREATED,
)
def invite_member(
    project_id: UUID,
    body: MemberInvite,
    membership: ProjectMember = Depends(require_owner),
    db: Session = Depends(get_db),
) -> MemberPublic:
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "not_found",
                    "message": "This email hasn't signed in yet. Ask them to sign in with Google first.",
                }
            },
        )
    existing = db.execute(
        select(ProjectMember).where(
            and_(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"error": {"code": "conflict", "message": "User is already a member."}},
        )
    new_member = ProjectMember(project_id=project_id, user_id=user.id, role=body.role)
    db.add(new_member)
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="member.added",
        target_type="member",
        target_id=user.id,
        payload={"email": user.email, "role": body.role},
    )
    db.commit()
    return MemberPublic(
        user_id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        role=body.role,
    )


@router.patch("/{project_id}/members/{user_id}", response_model=MemberPublic)
def change_role(
    project_id: UUID,
    user_id: UUID,
    body: MemberRoleUpdate,
    membership: ProjectMember = Depends(require_owner),
    db: Session = Depends(get_db),
) -> MemberPublic:
    target = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Member not found."}},
        )

    # Last-owner protection: cannot demote the last owner.
    if target.role == "owner" and body.role != "owner" and _count_owners(db, project_id) <= 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "conflict",
                    "message": "Promote another member to owner first.",
                }
            },
        )

    target.role = body.role
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="member.role_changed",
        target_type="member",
        target_id=user_id,
        payload={"role": body.role},
    )
    db.commit()
    user = db.get(User, user_id)
    assert user is not None
    return MemberPublic(
        user_id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        role=body.role,
    )


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: UUID,
    user_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Remove a member.

    Owners can remove anyone. A user can remove *themselves* (Leave project) at any
    role. Either way, last-owner removal is blocked.
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

    target = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Member not found."}},
        )

    is_self = user_id == user.id
    if not is_self and not membership.is_owner():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "error": {"code": "unauthorized", "message": "Only owners can remove other members."}
            },
        )

    if target.role == "owner" and _count_owners(db, project_id) <= 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "conflict",
                    "message": "Promote another member to owner first.",
                }
            },
        )

    db.delete(target)
    activity.emit(
        db,
        project_id=project_id,
        user_id=user.id,
        kind="member.removed",
        target_type="member",
        target_id=user_id,
        payload={"self": is_self},
    )
    db.commit()
