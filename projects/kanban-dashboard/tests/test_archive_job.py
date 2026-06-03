"""Tests for the internal auto-archive job endpoint.

POST /api/v2/internal/archive-done
Auth: Authorization: Bearer {INTERNAL_SECRET}

The job scans all projects with auto_archive_days > 0 and archives eligible
Done tasks (non-deleted, non-archived, updated_at older than the threshold).
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from server.config import Settings, get_settings

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_JOB_URL = "/api/v2/internal/archive-done"
_TEST_SECRET = "test-secret-abc123"


def _make_settings_override(secret: str = _TEST_SECRET):
    """Return a dependency-override callable that yields a Settings with the given secret."""
    # We must read the real DATABASE_URL from the environment so the job's
    # get_db dependency talks to the test database, not a default URL.
    import os

    db_url = os.environ.get("DATABASE_URL", "postgresql+psycopg://kanban:kanban@127.0.0.1:5433/kanban_test")

    def _override() -> Settings:
        return Settings(
            database_url=db_url,
            internal_secret=secret,
            test_auth_bypass=True,
            app_env="development",
        )

    return _override


def _auth(secret: str = _TEST_SECRET) -> dict[str, str]:
    return {"Authorization": f"Bearer {secret}"}


def _new_project(client: TestClient, name: str = "Test Project", auto_archive_days: int | None = None) -> str:
    r = client.post("/api/v2/projects", json={"name": name})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    if auto_archive_days is not None:
        pr = client.patch(f"/api/v2/projects/{pid}", json={"auto_archive_days": auto_archive_days})
        assert pr.status_code == 200, pr.text
    return pid


def _new_task(client: TestClient, pid: str, title: str = "Task", column: str = "backlog") -> dict:
    r = client.post(f"/api/v2/projects/{pid}/tasks", json={"title": title, "column": column})
    assert r.status_code == 201, r.text
    return r.json()


def _backdate_task(db_session, task_id: str, days: int) -> None:
    """Directly set updated_at on a task to simulate it being old."""
    from uuid import UUID

    from sqlalchemy import update

    from server.models.task import Task

    old_ts = datetime.now(UTC) - timedelta(days=days)
    db_session.execute(
        update(Task).where(Task.id == UUID(task_id)).values(updated_at=old_ts)
    )
    db_session.commit()


@pytest.fixture()
def job_client(signed_in_user):
    """A TestClient with get_settings dependency overridden to inject the test secret.

    Shares the session cookie from signed_in_user so API calls are authenticated.
    """
    from server.main import create_app

    _, owner_client = signed_in_user
    app = create_app()
    app.dependency_overrides[get_settings] = _make_settings_override()
    with TestClient(app) as c:
        c.cookies = owner_client.cookies
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_archive_job_archives_eligible_tasks(job_client, signed_in_user, db_session) -> None:
    """Job archives Done tasks whose updated_at exceeds the project threshold."""
    pid = _new_project(job_client, "Auto-archive project", auto_archive_days=1)
    t1 = _new_task(job_client, pid, "Old done 1", column="done")
    t2 = _new_task(job_client, pid, "Old done 2", column="done")

    # Backdate both tasks by 2 days (exceeds threshold of 1 day)
    _backdate_task(db_session, t1["id"], days=2)
    _backdate_task(db_session, t2["id"], days=2)

    r = job_client.post(_JOB_URL, headers=_auth())
    assert r.status_code == 200, r.text
    assert r.json() == {"archived": 2}

    # Both tasks must now have archived_at set
    archived = job_client.get(f"/api/v2/projects/{pid}/tasks?archived=true").json()["items"]
    archived_ids = {t["id"] for t in archived}
    assert t1["id"] in archived_ids
    assert t2["id"] in archived_ids


def test_archive_job_skips_non_done(job_client, db_session) -> None:
    """Job does NOT archive tasks that are not in the 'done' column."""
    pid = _new_project(job_client, "Skip non-done", auto_archive_days=1)
    backlog_task = _new_task(job_client, pid, "In backlog", column="backlog")
    inprogress_task = _new_task(job_client, pid, "In progress", column="inprogress")

    _backdate_task(db_session, backlog_task["id"], days=2)
    _backdate_task(db_session, inprogress_task["id"], days=2)

    r = job_client.post(_JOB_URL, headers=_auth())
    assert r.status_code == 200
    assert r.json()["archived"] == 0

    # Confirm neither task is archived
    active = job_client.get(f"/api/v2/projects/{pid}/tasks").json()["items"]
    active_ids = {t["id"] for t in active}
    assert backlog_task["id"] in active_ids
    assert inprogress_task["id"] in active_ids


def test_archive_job_skips_already_archived(job_client, db_session) -> None:
    """Job does not re-archive tasks that already have archived_at set."""
    from uuid import UUID

    from sqlalchemy import update

    from server.models.task import Task

    pid = _new_project(job_client, "Skip re-archive", auto_archive_days=1)
    task = _new_task(job_client, pid, "Pre-archived done", column="done")

    # Backdate updated_at so it would qualify, then manually set archived_at
    _backdate_task(db_session, task["id"], days=2)
    original_archived_at = datetime.now(UTC)
    db_session.execute(
        update(Task).where(Task.id == UUID(task["id"])).values(archived_at=original_archived_at)
    )
    db_session.commit()

    r = job_client.post(_JOB_URL, headers=_auth())
    assert r.status_code == 200
    assert r.json()["archived"] == 0


def test_archive_job_respects_auto_archive_days(job_client, db_session) -> None:
    """Job respects the per-project threshold: task within threshold is NOT archived."""
    pid = _new_project(job_client, "Threshold test", auto_archive_days=7)
    t_within = _new_task(job_client, pid, "6 days old safe", column="done")
    t_beyond = _new_task(job_client, pid, "8 days old archive", column="done")

    _backdate_task(db_session, t_within["id"], days=6)
    _backdate_task(db_session, t_beyond["id"], days=8)

    r = job_client.post(_JOB_URL, headers=_auth())
    assert r.status_code == 200
    assert r.json()["archived"] == 1

    archived = job_client.get(f"/api/v2/projects/{pid}/tasks?archived=true").json()["items"]
    archived_ids = {t["id"] for t in archived}
    assert t_beyond["id"] in archived_ids
    assert t_within["id"] not in archived_ids


def test_archive_job_requires_internal_secret(signed_in_user) -> None:
    """Job returns 401 with a wrong token or no Authorization header."""
    from server.main import create_app

    _, owner_client = signed_in_user
    app = create_app()
    app.dependency_overrides[get_settings] = _make_settings_override()
    with TestClient(app) as job_c:
        job_c.cookies = owner_client.cookies

        # Wrong token
        r = job_c.post(_JOB_URL, headers={"Authorization": "Bearer wrong-secret"})
        assert r.status_code == 401

        # No Authorization header
        r = job_c.post(_JOB_URL)
        assert r.status_code == 401
    app.dependency_overrides.clear()


def test_archive_job_zero_days_disables(job_client, db_session) -> None:
    """A project with auto_archive_days=0 is skipped by the job."""
    pid = _new_project(job_client, "Zero days", auto_archive_days=0)
    task = _new_task(job_client, pid, "Very old done task", column="done")
    _backdate_task(db_session, task["id"], days=30)

    r = job_client.post(_JOB_URL, headers=_auth())
    assert r.status_code == 200
    assert r.json()["archived"] == 0

    active = job_client.get(f"/api/v2/projects/{pid}/tasks").json()["items"]
    assert any(t["id"] == task["id"] for t in active)


def test_archive_job_null_days_disables(job_client, db_session) -> None:
    """A project with auto_archive_days=None (not set) is skipped by the job."""
    # Do NOT pass auto_archive_days — leaves it as NULL
    pid = _new_project(job_client, "No auto-archive config")
    task = _new_task(job_client, pid, "Old done task", column="done")
    _backdate_task(db_session, task["id"], days=30)

    r = job_client.post(_JOB_URL, headers=_auth())
    assert r.status_code == 200
    assert r.json()["archived"] == 0

    active = job_client.get(f"/api/v2/projects/{pid}/tasks").json()["items"]
    assert any(t["id"] == task["id"] for t in active)
