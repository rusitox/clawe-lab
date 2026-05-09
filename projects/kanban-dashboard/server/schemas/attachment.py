from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AttachmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    project_id: UUID
    original_name: str
    mime: str
    size_bytes: int
    uploaded_by: UUID
    created_at: datetime
