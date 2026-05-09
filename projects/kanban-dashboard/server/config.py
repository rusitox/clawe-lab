from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development")
    app_version: str = Field(default="2.0.0a0")

    database_url: str = Field(
        default="postgresql+psycopg://kanban:kanban@127.0.0.1:5433/kanban"
    )

    session_secret: str = Field(default="dev-only-not-for-prod")
    session_cookie_name: str = Field(default="kanban_session")
    session_max_age_seconds: int = Field(default=60 * 60 * 24 * 30)

    google_client_id: str = Field(default="")
    google_client_secret: str = Field(default="")
    oauth_redirect_uri: str = Field(default="http://127.0.0.1:8787/auth/google/callback")

    allowed_emails: str = Field(default="")
    allowed_domains: str = Field(default="")

    attachments_dir: str = Field(default="./var/attachments")
    attachments_max_bytes: int = Field(default=10 * 1024 * 1024)

    poll_interval_ms: int = Field(default=8000)
    test_auth_bypass: bool = Field(default=False)

    legacy_kanban_token: str = Field(default="")


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
