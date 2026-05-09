from __future__ import annotations

import os
from collections.abc import Iterator

# IMPORTANT: set test-only env BEFORE any server module imports settings, since
# get_settings() caches the Settings instance the first time it's called.
DEFAULT_TEST_DB_URL = "postgresql+psycopg://kanban:kanban@127.0.0.1:5433/kanban_test"
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("TEST_AUTH_BYPASS", "true")
os.environ.setdefault(
    "DATABASE_URL", os.environ.get("DATABASE_URL_TEST", DEFAULT_TEST_DB_URL)
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


@pytest.fixture(scope="session")
def database_url() -> str:
    return os.environ.get("DATABASE_URL_TEST", DEFAULT_TEST_DB_URL)


@pytest.fixture(scope="session", autouse=True)
def _prepare_database(database_url: str) -> Iterator[None]:
    """Create the test database and apply extensions before the suite runs.

    Uses the maintenance database `postgres` to issue CREATE DATABASE.
    """
    admin_url = database_url.rsplit("/", 1)[0] + "/postgres"
    target_db = database_url.rsplit("/", 1)[1]

    admin_engine: Engine = create_engine(admin_url, isolation_level="AUTOCOMMIT", future=True)
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target_db}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{target_db}"'))
    admin_engine.dispose()

    test_engine = create_engine(database_url, future=True)
    with test_engine.begin() as conn:
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pgcrypto"'))
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "citext"'))
    test_engine.dispose()

    os.environ["DATABASE_URL"] = database_url
    os.environ["TEST_AUTH_BYPASS"] = "true"
    os.environ["APP_ENV"] = "development"

    # Apply migrations to bring the test DB up to head.
    from alembic import command
    from alembic.config import Config

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(alembic_cfg, "head")

    yield


@pytest.fixture(autouse=True)
def _reset_db(database_url: str) -> Iterator[None]:
    """Truncate all tables before each test for isolation.

    Migrations run once via alembic before the suite (use `make migrate` against
    the test DB once, or run `alembic upgrade head` manually after `_prepare_database`).
    """
    engine = create_engine(database_url, future=True)
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname='public' AND tablename != 'alembic_version'"
            )
        ).all()
        names = [r[0] for r in rows]
        if names:
            conn.execute(text(f"TRUNCATE {', '.join(names)} RESTART IDENTITY CASCADE"))
    engine.dispose()
    yield


@pytest.fixture()
def client() -> Iterator[TestClient]:
    from server.main import create_app

    app = create_app()
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def client_factory():
    """Build fresh TestClient instances (independent cookie jars) for cross-user tests."""
    from server.main import create_app

    created: list[TestClient] = []

    def _make() -> TestClient:
        app = create_app()
        c = TestClient(app)
        created.append(c)
        return c

    yield _make
    for c in created:
        c.close()


@pytest.fixture()
def db_session(database_url: str) -> Iterator:
    from server.db import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def signed_in_user(db_session, client: TestClient):
    """Create a user via test bypass and return (user, client_with_session_cookie)."""
    from server.auth.test_bypass import upsert_user_by_email

    user = upsert_user_by_email(db_session, "marian@example.com", "Marian")
    response = client.get(
        f"/auth/test-login?email={user.email}", follow_redirects=False
    )
    assert response.status_code == 302, response.text
    return user, client


@pytest.fixture()
def second_user(db_session):
    from server.auth.test_bypass import upsert_user_by_email

    return upsert_user_by_email(db_session, "juan@example.com", "Juan")
