from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from server.api import home as home_router
from server.api import v1_legacy as v1_legacy_router
from server.api.v2 import activity as activity_router
from server.api.v2 import attachments as attachments_router
from server.api.v2 import comments as comments_router
from server.api.v2 import me as me_router
from server.api.v2 import projects as projects_router
from server.api.v2 import tasks as tasks_router
from server.api.v2 import teams as teams_router
from server.api.v2 import tokens as tokens_router
from server.auth import routes as auth_routes
from server.config import get_settings
from server.db import ping

logger = logging.getLogger("kanban")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def create_app() -> FastAPI:
    settings = get_settings()

    if settings.app_env == "production" and settings.test_auth_bypass:
        raise RuntimeError("TEST_AUTH_BYPASS must not be enabled in production.")

    app = FastAPI(
        title="Clawe Kanban",
        version=settings.app_version,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    @app.get("/api/health")
    def health() -> JSONResponse:
        try:
            db_ok = ping()
        except Exception:
            logger.exception("db health check failed")
            db_ok = False
        body = {
            "ok": db_ok,
            "version": settings.app_version,
            "db": "up" if db_ok else "down",
        }
        return JSONResponse(body, status_code=200 if db_ok else 503)

    app.include_router(home_router.router)
    app.include_router(auth_routes.router)
    app.include_router(me_router.router)
    app.include_router(tokens_router.router)
    app.include_router(projects_router.router)
    app.include_router(teams_router.router)
    app.include_router(tasks_router.router)
    app.include_router(activity_router.router)
    app.include_router(attachments_router.per_task_router)
    app.include_router(attachments_router.flat_router)
    app.include_router(comments_router.per_task_router)
    app.include_router(comments_router.flat_router)
    app.include_router(v1_legacy_router.router)

    try:
        app.mount("/static", StaticFiles(directory="static"), name="static")
    except RuntimeError:
        logger.info("static/ directory not present, skipping mount")

    return app


app = create_app()
