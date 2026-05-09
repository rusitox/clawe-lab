from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CommentCreate(BaseModel):
    body_md: str = Field(min_length=1, max_length=20000)

    @field_validator("body_md")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty.")
        return v


class CommentUpdate(BaseModel):
    body_md: str = Field(min_length=1, max_length=20000)

    @field_validator("body_md")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty.")
        return v


class CommentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    project_id: UUID
    user_id: UUID
    body_md: str
    body_html: str
    created_at: datetime
    updated_at: datetime
