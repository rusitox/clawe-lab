from __future__ import annotations

from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from server.db import Base
from server.models._types import created_at


class OAuthState(Base):
    __tablename__ = "oauth_states"

    state: Mapped[str] = mapped_column(String(128), primary_key=True)
    redirect_to: Mapped[str | None] = mapped_column(String(1024))
    created_at: Mapped[datetime] = created_at()
