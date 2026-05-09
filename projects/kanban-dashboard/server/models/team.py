from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from server.db import Base
from server.models._types import created_at, uuid_pk


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_teams_project_name"),
        Index("ix_teams_project", "project_id"),
    )

    id: Mapped[UUID] = uuid_pk()
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = created_at()
