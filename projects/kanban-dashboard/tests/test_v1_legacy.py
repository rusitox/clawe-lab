from __future__ import annotations

from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures" / "v1_snapshot"
LEGACY_TOKEN = "test-legacy-secret"


@pytest.fixture(autouse=True)
def _set_legacy_token(monkeypatch) -> None:
    monkeypatch.setenv("LEGACY_KANBAN_TOKEN", LEGACY_TOKEN)
    # Force settings re-read so the new token is in effect.
    import server.config as cfg
    from server.config import get_settings as _gs
    cfg._settings = None
    _gs()
    yield
    cfg._settings = None


@pytest.fixture()
def imported(signed_in_user):
    user, _ = signed_in_user
    from scripts.import_v1 import run

    run(
        owner_email=user.email,
        project_name="Clawe HQ",
        tasks_path=FIXTURES / "tasks.json",
        activity_path=FIXTURES / "activity.json",
        teams_path=FIXTURES / "teams.json",
    )
    return user


def test_legacy_tasks_requires_token(client) -> None:
    r = client.get("/api/tasks")
    assert r.status_code == 401
    # Even on auth failure, the deprecation headers are emitted.
    assert r.headers.get("Deprecation") == "true"
    assert r.headers.get("Sunset") == "2026-09-30"


def test_legacy_tasks_with_token(client, imported) -> None:
    r = client.get("/api/tasks", headers={"X-Kanban-Token": LEGACY_TOKEN})
    assert r.status_code == 200
    body = r.json()
    assert body["version"] == 1
    assert len(body["tasks"]) == 3
    assert {"col", "prio", "title", "desc", "createdAt"}.issubset(body["tasks"][0].keys())
    assert r.headers.get("Deprecation") == "true"
    assert r.headers.get("Sunset") == "2026-09-30"
    assert "successor-version" in r.headers.get("Link", "")


def test_legacy_teams(client, imported) -> None:
    r = client.get("/api/teams", headers={"X-Kanban-Token": LEGACY_TOKEN})
    assert r.status_code == 200
    teams = r.json()["teams"]
    assert "General" in teams and "Engineering" in teams


def test_legacy_activity(client, imported) -> None:
    r = client.get("/api/activity", headers={"X-Kanban-Token": LEGACY_TOKEN})
    assert r.status_code == 200
    events = r.json()["events"]
    assert len(events) >= 2
    # The fixture activities come back with their original agent + text
    agents = {e["agent"] for e in events}
    assert {"Clawe", "Rusitox"} & agents


def test_legacy_writes_are_410_gone(client) -> None:
    r = client.put("/api/tasks", headers={"X-Kanban-Token": LEGACY_TOKEN}, json={})
    assert r.status_code == 410
    assert r.json()["detail"]["error"]["code"] == "gone"
    assert r.headers.get("Deprecation") == "true"


def test_no_default_project_returns_503(client) -> None:
    """Without running the importer, the legacy endpoints can't find Clawe HQ."""
    r = client.get("/api/tasks", headers={"X-Kanban-Token": LEGACY_TOKEN})
    assert r.status_code == 503
    assert "Run scripts/import_v1.py" in r.json()["detail"]["error"]["message"]


def test_legacy_disabled_when_token_unset(monkeypatch, client) -> None:
    monkeypatch.delenv("LEGACY_KANBAN_TOKEN", raising=False)
    monkeypatch.setenv("LEGACY_KANBAN_TOKEN", "")
    import server.config as cfg
    cfg._settings = None
    r = client.get("/api/tasks", headers={"X-Kanban-Token": "anything"})
    assert r.status_code == 503
    assert "disabled" in r.json()["detail"]["error"]["message"].lower()
