from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from server.models.task import TASK_COLUMNS, TASK_KINDS, TASK_PRIORITIES


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    kind: str = Field(default="task")
    column: str = Field(default="backlog")
    priority: str | None = None
    team_id: UUID | None = None
    description_md: str = Field(default="", max_length=20000)
    labels: list[str] = Field(default_factory=list, max_length=32)
    assignees: list[UUID] = Field(default_factory=list, max_length=32)
    after_task_id: UUID | None = None  # insert after this task in the column

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty.")
        return v

    @field_validator("kind")
    @classmethod
    def _check_kind(cls, v: str) -> str:
        if v not in TASK_KINDS:
            raise ValueError(f"kind must be one of {TASK_KINDS!r}")
        return v

    @field_validator("column")
    @classmethod
    def _check_column(cls, v: str) -> str:
        if v not in TASK_COLUMNS:
            raise ValueError(f"column must be one of {TASK_COLUMNS!r}")
        return v

    @field_validator("priority")
    @classmethod
    def _check_priority(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in TASK_PRIORITIES:
            raise ValueError(f"priority must be one of {TASK_PRIORITIES!r}")
        return v


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    kind: str | None = None
    priority: str | None = None
    team_id: UUID | None = None
    description_md: str | None = Field(default=None, max_length=20000)
    labels: list[str] | None = Field(default=None, max_length=32)
    assignees: list[UUID] | None = Field(default=None, max_length=32)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty.")
        return v

    @field_validator("kind")
    @classmethod
    def _check_kind(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in TASK_KINDS:
            raise ValueError(f"kind must be one of {TASK_KINDS!r}")
        return v

    @field_validator("priority")
    @classmethod
    def _check_priority(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in TASK_PRIORITIES:
            raise ValueError(f"priority must be one of {TASK_PRIORITIES!r}")
        return v


class TaskMove(BaseModel):
    column: str
    after_task_id: UUID | None = None  # if both None → top of column
    before_task_id: UUID | None = None

    @field_validator("column")
    @classmethod
    def _check_column(cls, v: str) -> str:
        if v not in TASK_COLUMNS:
            raise ValueError(f"column must be one of {TASK_COLUMNS!r}")
        return v


class TaskPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    kind: str
    column: str
    position: float
    priority: str | None
    team_id: UUID | None
    title: str
    description_md: str
    description_html: str
    labels: list[str]
    created_by: UUID
    assignees: list[UUID]
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    items: list[TaskPublic]
