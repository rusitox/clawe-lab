from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.config import get_settings
from server.models.oauth_state import OAuthState
from server.models.user import User

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

STATE_TTL = timedelta(minutes=10)


class OAuthError(Exception):
    pass


class AllowListRejection(OAuthError):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def _allow_list_check(email: str) -> None:
    settings = get_settings()
    allowed_emails = {e.strip().lower() for e in settings.allowed_emails.split(",") if e.strip()}
    allowed_domains = {d.strip().lower() for d in settings.allowed_domains.split(",") if d.strip()}
    if not allowed_emails and not allowed_domains:
        return
    email = email.lower()
    if email in allowed_emails:
        return
    domain = email.rsplit("@", 1)[-1] if "@" in email else ""
    if domain in allowed_domains:
        return
    raise AllowListRejection(email)


def issue_state(db: Session, redirect_to: str | None = None) -> str:
    state = secrets.token_urlsafe(32)
    db.add(OAuthState(state=state, redirect_to=redirect_to))
    db.commit()
    return state


def consume_state(db: Session, state: str) -> str | None:
    row = db.execute(select(OAuthState).where(OAuthState.state == state)).scalar_one_or_none()
    if row is None:
        return None
    redirect_to = row.redirect_to
    db.delete(row)
    db.commit()
    if _now() - row.created_at > STATE_TTL:
        return None
    return redirect_to


def authorize_url(state: str) -> str:
    settings = get_settings()
    params = {
        "response_type": "code",
        "client_id": settings.google_client_id,
        "redirect_uri": settings.oauth_redirect_uri,
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    qs = "&".join(f"{k}={httpx.QueryParams({k: v})[k]}" for k, v in params.items())
    return f"{GOOGLE_AUTH_URL}?{qs}"


def exchange_code(code: str) -> dict[str, Any]:
    settings = get_settings()
    resp = httpx.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.oauth_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=10.0,
    )
    if resp.status_code != 200:
        raise OAuthError(f"token exchange failed: {resp.status_code} {resp.text}")
    body: dict[str, Any] = resp.json()
    return body


def fetch_userinfo(access_token: str) -> dict[str, Any]:
    resp = httpx.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10.0,
    )
    if resp.status_code != 200:
        raise OAuthError(f"userinfo failed: {resp.status_code} {resp.text}")
    body: dict[str, Any] = resp.json()
    return body


def upsert_user(db: Session, profile: dict[str, Any]) -> User:
    sub = profile.get("sub")
    email = profile.get("email")
    if not sub or not email:
        raise OAuthError("Google profile missing sub or email")
    _allow_list_check(email)

    user = db.execute(select(User).where(User.google_sub == sub)).scalar_one_or_none()
    if user is None:
        user = User(
            google_sub=sub,
            email=email,
            name=profile.get("name"),
            avatar_url=profile.get("picture"),
        )
        db.add(user)
    else:
        user.email = email
        user.name = profile.get("name") or user.name
        user.avatar_url = profile.get("picture") or user.avatar_url
    db.commit()
    db.refresh(user)
    return user
