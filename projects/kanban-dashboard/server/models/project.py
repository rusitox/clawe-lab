from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from server.db import Base
from server.models._types import created_at, updated_at, uuid_pk

PROJECT_ROLES = ("owner", "editor", "viewer")


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (Index("ix_projects_deleted_at", "deleted_at"),)

    id: Mapped[UUID] = uuid_pk()
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def is_active(self) -> bool:
        return self.deleted_at is None


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        CheckConstraint(
            f"role IN {PROJECT_ROLES!r}", name="ck_project_members_role"
        ),
        Index("ix_project_members_user", "user_id"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = created_at()

    def can_write(self) -> bool:
        return self.role in ("owner", "editor")

    def is_owner(self) -> bool:
        return self.role == "owner"
