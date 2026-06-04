"""Multi-tenant isolation gate tests (SDD §4 A9).

Verifies the contract: a user who is NOT a member of project X gets 404
(never 403, never 401, never 200) on every project-scoped resource. The
gate is implemented as a single FastAPI dependency `get_project_member`,
and these tests exercise it end-to-end via a mounted test route.
"""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session as DbSession

from server.deps import get_project_member
from server.main import create_app
from server.models.project import Project, ProjectMember


def _attach_probe_route(app) -> None:
    """Mount a tiny route that simply returns 200 + the project_id when the
    multi-tenant gate accepts the request. We use this to exercise the gate
    without depending on the full /api/v2/projects router (Phase 3)."""
    router = APIRouter()

    @router.get("/api/v2/projects/{project_id}/_probe")
    def probe(membership: ProjectMember = Depends(get_project_member)):
        return {"project_id": str(membership.project_id), "role": membership.role}

    app.include_router(router)


def _make_project(db: DbSession, owner_id: UUID, slug: str) -> Project:
    project = Project(slug=slug, name=slug.title(), created_by=owner_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    db.add(ProjectMember(project_id=project.id, user_id=owner_id, role="owner"))
    db.commit()
    return project


def test_member_can_reach_their_project(signed_in_user, db_session) -> None:
    user, client = signed_in_user
    _attach_probe_route(client.app)

    project = _make_project(db_session, user.id, "clawe-hq")

    r = client.get(f"/api/v2/projects/{project.id}/_probe")
    assert r.status_code == 200
    body = r.json()
    assert body["project_id"] == str(project.id)
    assert body["role"] == "owner"


def test_non_member_gets_404_not_403(signed_in_user, second_user, db_session) -> None:
    """The most important multi-tenant test: a non-member must NOT be able
    to learn whether the project exists at all."""
    user, client = signed_in_user

    other_project = _make_project(db_session, second_user.id, "secret-juan")

    app = create_app()
    _attach_probe_route(app)
    fresh = TestClient(app)
    fresh.cookies = client.cookies

    r = fresh.get(f"/api/v2/projects/{other_project.id}/_probe")
    assert r.status_code == 404
    body = r.json()
    assert body["detail"]["error"]["code"] == "not_found"


def test_unknown_project_id_also_404(signed_in_user) -> None:
    _, client = signed_in_user
    _attach_probe_route(client.app)

    r = client.get(f"/api/v2/projects/{uuid4()}/_probe")
    assert r.status_code == 404


def test_unauthenticated_gets_401_not_404(client) -> None:
    """Auth check fires before the gate — unauthenticated users get 401, not 404."""
    _attach_probe_route(client.app)

    r = client.get(f"/api/v2/projects/{uuid4()}/_probe")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# P6.5 — Archive isolation tests
# ---------------------------------------------------------------------------


def _create_user_and_project(db: DbSession, email: str, slug: str) -> tuple:
    from server.auth.test_bypass import upsert_user_by_email

    user = upsert_user_by_email(db, email, email.split("@")[0].capitalize())
    project = _make_project(db, user.id, slug)
    return user, project


def test_archive_task_cross_tenant_blocked(signed_in_user, second_user, db_session, client_factory) -> None:
    """user_a cannot archive a task in project_b where user_a is not a member — returns 404."""
    user_a, client_a = signed_in_user

    # user_b creates a project with a task
    project_b = _make_project(db_session, second_user.id, "project-b-archive")
    client_b = client_factory()
    client_b.get(
        f"/auth/test-login?email={second_user.email}&name=Juan",
        follow_redirects=False,
    )
    task = client_b.post(
        f"/api/v2/projects/{project_b.id}/tasks",
        json={"title": "Juan's task", "column": "done"},
    ).json()

    # user_a attempts to archive user_b's task via user_b's project endpoint
    r = client_a.post(f"/api/v2/projects/{project_b.id}/tasks/{task['id']}/archive")
    assert r.status_code == 404
    assert r.json()["detail"]["error"]["code"] == "not_found"


def test_unarchive_task_cross_tenant_blocked(signed_in_user, second_user, db_session, client_factory) -> None:
    """user_a cannot unarchive a task in project_b where user_a is not a member — returns 404."""
    user_a, client_a = signed_in_user

    project_b = _make_project(db_session, second_user.id, "project-b-unarchive")
    client_b = client_factory()
    client_b.get(
        f"/auth/test-login?email={second_user.email}&name=Juan",
        follow_redirects=False,
    )
    task = client_b.post(
        f"/api/v2/projects/{project_b.id}/tasks",
        json={"title": "Juan's task", "column": "done"},
    ).json()
    # Archive the task as user_b
    client_b.post(f"/api/v2/projects/{project_b.id}/tasks/{task['id']}/archive")

    # user_a attempts to unarchive user_b's task
    r = client_a.post(
        f"/api/v2/projects/{project_b.id}/tasks/{task['id']}/unarchive",
        json={"column": "backlog"},
    )
    assert r.status_code == 404
    assert r.json()["detail"]["error"]["code"] == "not_found"
