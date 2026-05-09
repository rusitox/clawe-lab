from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from server.db import get_db
from server.deps import get_project_member, require_writer
from server.models.project import ProjectMember
from server.models.team import Team
from server.schemas.team import TeamCreate, TeamPublic, TeamUpdate
from server.services import activity

router = APIRouter(
    prefix="/api/v2/projects/{project_id}/teams",
    tags=["teams"],
)


def _team_or_404(db: Session, project_id: UUID, team_id: UUID) -> Team:
    team = db.execute(
        select(Team).where(Team.id == team_id, Team.project_id == project_id)
    ).scalar_one_or_none()
    if team is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Team not found."}},
        )
    return team


@router.get("", response_model=list[TeamPublic])
def list_teams(
    project_id: UUID,
    membership: ProjectMember = Depends(get_project_member),
    db: Session = Depends(get_db),
) -> list[Team]:
    rows = db.execute(
        select(Team).where(Team.project_id == project_id).order_by(Team.created_at.asc())
    ).scalars()
    return list(rows)


@router.post("", response_model=TeamPublic, status_code=status.HTTP_201_CREATED)
def create_team(
    project_id: UUID,
    body: TeamCreate,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> Team:
    team = Team(project_id=project_id, name=body.name, color=body.color)
    db.add(team)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"error": {"code": "conflict", "message": "Team name already used in this project."}},
        ) from exc
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="team.created",
        target_type="team",
        target_id=team.id,
        payload={"name": team.name, "color": team.color},
    )
    db.commit()
    db.refresh(team)
    return team


@router.patch("/{team_id}", response_model=TeamPublic)
def update_team(
    project_id: UUID,
    team_id: UUID,
    body: TeamUpdate,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> Team:
    team = _team_or_404(db, project_id, team_id)
    if body.name is not None:
        team.name = body.name
    if body.color is not None:
        team.color = body.color
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"error": {"code": "conflict", "message": "Team name already used in this project."}},
        ) from exc
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="team.updated",
        target_type="team",
        target_id=team.id,
        payload={"name": team.name, "color": team.color},
    )
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    project_id: UUID,
    team_id: UUID,
    membership: ProjectMember = Depends(require_writer),
    db: Session = Depends(get_db),
) -> None:
    team = _team_or_404(db, project_id, team_id)
    db.delete(team)
    activity.emit(
        db,
        project_id=project_id,
        user_id=membership.user_id,
        kind="team.deleted",
        target_type="team",
        target_id=team_id,
    )
    db.commit()
