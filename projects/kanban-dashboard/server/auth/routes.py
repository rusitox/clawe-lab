from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from server.auth import google_oauth, sessions, test_bypass
from server.config import get_settings
from server.db import get_db

router = APIRouter()
templates = Jinja2Templates(directory="server/templates")


def _set_session_cookie(resp: RedirectResponse, sid: str) -> None:
    settings = get_settings()
    resp.set_cookie(
        key=settings.session_cookie_name,
        value=sid,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        path="/",
    )


@router.get("/login", response_class=HTMLResponse)
def login_page(
    request: Request, error: str | None = None, rejection: str | None = None
) -> HTMLResponse:
    return templates.TemplateResponse(
        request,
        "login.html",
        {"error": error, "rejection": rejection},
    )


@router.get("/auth/google/start")
def google_start(request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing)",
        )
    state = google_oauth.issue_state(db, redirect_to=str(request.query_params.get("next") or "/"))
    return RedirectResponse(google_oauth.authorize_url(state), status_code=302)


@router.get("/auth/google/callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if error or not code or not state:
        return RedirectResponse("/login?error=oauth_failed", status_code=302)
    redirect_to = google_oauth.consume_state(db, state)
    if redirect_to is None:
        return RedirectResponse("/login?error=invalid_state", status_code=302)

    try:
        token_data = google_oauth.exchange_code(code)
        profile = google_oauth.fetch_userinfo(token_data["access_token"])
        user = google_oauth.upsert_user(db, profile)
    except google_oauth.AllowListRejection:
        return RedirectResponse("/login?rejection=1", status_code=302)
    except google_oauth.OAuthError:
        return RedirectResponse("/login?error=oauth_failed", status_code=302)

    session_row = sessions.issue_session(db, user, request.headers.get("user-agent"))
    resp = RedirectResponse(redirect_to or "/", status_code=302)
    _set_session_cookie(resp, session_row.id)
    return resp


@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    settings = get_settings()
    sid = request.cookies.get(settings.session_cookie_name)
    if sid:
        sessions.destroy_session(db, sid)
    resp = RedirectResponse("/login", status_code=302)
    resp.delete_cookie(settings.session_cookie_name, path="/")
    return resp


@router.get("/auth/test-login", include_in_schema=False)
def test_login(
    request: Request,
    email: str,
    name: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if not test_bypass.is_enabled():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    user = test_bypass.upsert_user_by_email(db, email, name)
    session_row = sessions.issue_session(db, user, request.headers.get("user-agent"))
    resp = RedirectResponse("/", status_code=302)
    _set_session_cookie(resp, session_row.id)
    return resp
