from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str = Field(min_length=7, max_length=7)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty.")
        return v

    @field_validator("color")
    @classmethod
    def _check_color(cls, v: str) -> str:
        if not _HEX_RE.match(v):
            raise ValueError("Color must be hex like #3b82f6.")
        return v.lower()


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty.")
        return v

    @field_validator("color")
    @classmethod
    def _check_color(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _HEX_RE.match(v):
            raise ValueError("Color must be hex like #3b82f6.")
        return v.lower()


class TeamPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    color: str
    created_at: datetime
