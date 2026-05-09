from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from server.models.project import PROJECT_ROLES

_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$")


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:120] or "project"


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=120)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty.")
        return v

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not _SLUG_RE.match(v):
            raise ValueError(
                "Slug must be lowercase letters, digits, and hyphens (3-120 chars)."
            )
        return v

    def resolve_slug(self) -> str:
        return self.slug or _slugify(self.name)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty.")
        return v


class ProjectPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    created_at: datetime
    updated_at: datetime


class MemberPublic(BaseModel):
    user_id: UUID
    email: EmailStr
    name: str | None
    avatar_url: str | None
    role: str


class ProjectDetail(ProjectPublic):
    members: list[MemberPublic]
    your_role: str


class MemberInvite(BaseModel):
    email: EmailStr
    role: str = Field(default="editor")

    @field_validator("role")
    @classmethod
    def _check_role(cls, v: str) -> str:
        if v not in PROJECT_ROLES:
            raise ValueError(f"role must be one of {PROJECT_ROLES!r}")
        return v


class MemberRoleUpdate(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def _check_role(cls, v: str) -> str:
        if v not in PROJECT_ROLES:
            raise ValueError(f"role must be one of {PROJECT_ROLES!r}")
        return v
