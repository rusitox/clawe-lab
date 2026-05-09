from __future__ import annotations

from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures" / "v1_snapshot"


@pytest.fixture()
def imported_owner(signed_in_user):
    user, _ = signed_in_user
    return user


def _run_import(owner_email: str, project_name: str = "Clawe HQ"):
    from scripts.import_v1 import run

    return run(
        owner_email=owner_email,
        project_name=project_name,
        tasks_path=FIXTURES / "tasks.json",
        activity_path=FIXTURES / "activity.json",
        teams_path=FIXTURES / "teams.json",
    )


def test_import_creates_project_teams_tasks(imported_owner) -> None:
    result = _run_import(imported_owner.email)
    assert result["project_slug"] == "clawe-hq"
    assert result["teams"] == 2
    assert result["tasks_created"] == 3
    assert result["tasks_updated"] == 0
    assert result["activity_inserted"] == 2


def test_import_is_idempotent(imported_owner) -> None:
    first = _run_import(imported_owner.email)
    second = _run_import(imported_owner.email)
    assert first["project_id"] == second["project_id"]
    # Re-runs update existing tasks rather than creating new ones.
    assert second["tasks_created"] == 0
    assert second["tasks_updated"] == 3
    # Activity is dedup'd by (ts, agent, text).
    assert second["activity_inserted"] == 0


def test_import_normalizes_columns_and_priorities(imported_owner, db_session) -> None:
    _run_import(imported_owner.email)
    from sqlalchemy import select

    from server.models.project import Project
    from server.models.task import Task

    project = db_session.execute(
        select(Project).where(Project.slug == "clawe-hq")
    ).scalar_one()
    tasks = list(
        db_session.execute(
            select(Task).where(Task.project_id == project.id, Task.deleted_at.is_(None))
        ).scalars()
    )
    titles = {t.title: t for t in tasks}

    # "inprogress" → "inprogress" (alias normalized)
    assert titles["Second task — in progress"].column == "inprogress"
    assert titles["Second task — in progress"].priority == "P0"
    # No team on the third → team_id is None
    assert titles["Third task without team"].team_id is None
    # Markdown rendered to HTML
    assert "<strong>markdown</strong>" in titles["First imported task"].description_html


def test_unknown_owner_email_raises(signed_in_user) -> None:
    with pytest.raises(SystemExit):
        _run_import("nobody@example.com")
