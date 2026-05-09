from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from server.db import Base
from server.models._types import created_at, updated_at, uuid_pk

TASK_KINDS = ("task", "bug", "proposal")
TASK_COLUMNS = ("backlog", "todo", "inprogress", "done")
TASK_PRIORITIES = ("P0", "P1", "P2", "P3")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(f"kind IN {TASK_KINDS!r}", name="ck_tasks_kind"),
        CheckConstraint(f'"column" IN {TASK_COLUMNS!r}', name="ck_tasks_column"),
        CheckConstraint(
            f"priority IS NULL OR priority IN {TASK_PRIORITIES!r}",
            name="ck_tasks_priority",
        ),
        Index("ix_tasks_project_column_position", "project_id", "column", "position"),
        Index("ix_tasks_project_kind", "project_id", "kind"),
        Index("ix_tasks_project_deleted", "project_id", "deleted_at"),
    )

    id: Mapped[UUID] = uuid_pk()
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    column: Mapped[str] = mapped_column(String(16), nullable=False)
    position: Mapped[float] = mapped_column(Float, nullable=False)
    priority: Mapped[str | None] = mapped_column(String(4))
    team_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description_md: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    description_html: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    labels: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list, server_default="{}"
    )
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TaskAssignee(Base):
    __tablename__ = "task_assignees"
    __table_args__ = (Index("ix_task_assignees_user", "user_id"),)

    task_id: Mapped[UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
