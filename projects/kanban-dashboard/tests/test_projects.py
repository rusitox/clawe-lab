from __future__ import annotations


def test_create_list_project(signed_in_user) -> None:
    user, client = signed_in_user

    create = client.post("/api/v2/projects", json={"name": "Clawe HQ"})
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["name"] == "Clawe HQ"
    assert body["slug"] == "clawe-hq"

    listing = client.get("/api/v2/projects")
    assert listing.status_code == 200
    rows = listing.json()
    assert any(r["slug"] == "clawe-hq" for r in rows)


def test_get_project_detail_includes_members_and_role(signed_in_user) -> None:
    user, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "Detail"}).json()["id"]

    r = client.get(f"/api/v2/projects/{pid}")
    assert r.status_code == 200
    body = r.json()
    assert body["your_role"] == "owner"
    assert len(body["members"]) == 1
    assert body["members"][0]["email"] == user.email


def test_invite_existing_user(signed_in_user, second_user) -> None:
    user, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "Invite"}).json()["id"]

    r = client.post(
        f"/api/v2/projects/{pid}/members",
        json={"email": second_user.email, "role": "editor"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "editor"

    members = client.get(f"/api/v2/projects/{pid}/members").json()
    assert len(members) == 2


def test_invite_unknown_email_returns_404(signed_in_user) -> None:
    _, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "x"}).json()["id"]
    r = client.post(
        f"/api/v2/projects/{pid}/members",
        json={"email": "stranger@example.com", "role": "editor"},
    )
    assert r.status_code == 404
    assert "hasn't signed in" in r.json()["detail"]["error"]["message"]


def test_invite_existing_member_409(signed_in_user, second_user) -> None:
    _, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "x"}).json()["id"]
    client.post(
        f"/api/v2/projects/{pid}/members", json={"email": second_user.email, "role": "editor"}
    )
    r = client.post(
        f"/api/v2/projects/{pid}/members", json={"email": second_user.email, "role": "viewer"}
    )
    assert r.status_code == 409


def test_change_role(signed_in_user, second_user) -> None:
    _, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "x"}).json()["id"]
    client.post(
        f"/api/v2/projects/{pid}/members", json={"email": second_user.email, "role": "editor"}
    )
    r = client.patch(
        f"/api/v2/projects/{pid}/members/{second_user.id}", json={"role": "viewer"}
    )
    assert r.status_code == 200
    assert r.json()["role"] == "viewer"


def test_cannot_demote_last_owner(signed_in_user) -> None:
    user, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "Solo"}).json()["id"]
    r = client.patch(
        f"/api/v2/projects/{pid}/members/{user.id}", json={"role": "editor"}
    )
    assert r.status_code == 409
    assert "Promote another" in r.json()["detail"]["error"]["message"]


def test_cannot_remove_last_owner_self(signed_in_user) -> None:
    user, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "Solo"}).json()["id"]
    r = client.delete(f"/api/v2/projects/{pid}/members/{user.id}")
    assert r.status_code == 409


def test_self_can_leave_when_not_last_owner(signed_in_user, second_user) -> None:
    user, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "x"}).json()["id"]
    # promote second_user to owner so user is not the last owner
    client.post(
        f"/api/v2/projects/{pid}/members", json={"email": second_user.email, "role": "owner"}
    )
    r = client.delete(f"/api/v2/projects/{pid}/members/{user.id}")
    assert r.status_code == 204


def test_non_owner_cannot_invite(signed_in_user, second_user, db_session, client_factory) -> None:
    """An editor cannot invite — only owners."""
    _, owner_client = signed_in_user
    pid = owner_client.post("/api/v2/projects", json={"name": "x"}).json()["id"]
    owner_client.post(
        f"/api/v2/projects/{pid}/members", json={"email": second_user.email, "role": "editor"}
    )

    juan_client = client_factory()
    juan_client.get(
        f"/auth/test-login?email={second_user.email}&name=Juan", follow_redirects=False
    )
    r = juan_client.post(
        f"/api/v2/projects/{pid}/members",
        json={"email": "newcomer@example.com", "role": "viewer"},
    )
    # editor → require_owner → 403
    assert r.status_code == 403
    assert r.json()["detail"]["error"]["code"] == "unauthorized"


def test_list_projects_only_shows_mine(signed_in_user, second_user, db_session, client_factory) -> None:
    user, client = signed_in_user
    mine = client.post("/api/v2/projects", json={"name": "Mine"}).json()

    juan_client = client_factory()
    juan_client.get(
        f"/auth/test-login?email={second_user.email}&name=Juan", follow_redirects=False
    )
    juan_client.post("/api/v2/projects", json={"name": "Juan only"})

    rows = client.get("/api/v2/projects").json()
    slugs = {r["slug"] for r in rows}
    assert mine["slug"] in slugs
    assert "juan-only" not in slugs


def test_soft_delete_hides_from_list(signed_in_user) -> None:
    _, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "Doomed"}).json()["id"]
    assert any(r["slug"] == "doomed" for r in client.get("/api/v2/projects").json())

    r = client.delete(f"/api/v2/projects/{pid}")
    assert r.status_code == 204
    assert all(r["slug"] != "doomed" for r in client.get("/api/v2/projects").json())
    # And the soft-deleted project is 404 to detail too:
    assert client.get(f"/api/v2/projects/{pid}").status_code == 404
