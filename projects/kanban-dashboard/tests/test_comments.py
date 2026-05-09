from __future__ import annotations


def _setup(client, name: str = "Comments project"):
    pid = client.post("/api/v2/projects", json={"name": name}).json()["id"]
    tid = client.post(f"/api/v2/projects/{pid}/tasks", json={"title": "T"}).json()["id"]
    return pid, tid


def test_create_and_list_comment(signed_in_user) -> None:
    _, client = signed_in_user
    pid, tid = _setup(client)
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/comments",
        json={"body_md": "**hi** there"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert "<strong>hi</strong>" in body["body_html"]

    listing = client.get(f"/api/v2/projects/{pid}/tasks/{tid}/comments").json()
    assert len(listing) == 1


def test_only_author_can_edit(signed_in_user, second_user, client_factory) -> None:
    _, marian = signed_in_user
    pid, tid = _setup(marian)
    marian.post(
        f"/api/v2/projects/{pid}/members",
        json={"email": second_user.email, "role": "editor"},
    )
    cid = marian.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/comments", json={"body_md": "mine"}
    ).json()["id"]

    juan = client_factory()
    juan.get(f"/auth/test-login?email={second_user.email}&name=Juan", follow_redirects=False)

    r = juan.patch(f"/api/v2/comments/{cid}", json={"body_md": "hijack"})
    assert r.status_code == 403
    assert r.json()["detail"]["error"]["code"] == "unauthorized"


def test_owner_can_delete_others_comment(signed_in_user, second_user, client_factory) -> None:
    _, marian = signed_in_user
    pid, tid = _setup(marian)
    marian.post(
        f"/api/v2/projects/{pid}/members",
        json={"email": second_user.email, "role": "editor"},
    )
    juan = client_factory()
    juan.get(f"/auth/test-login?email={second_user.email}&name=Juan", follow_redirects=False)

    cid = juan.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/comments", json={"body_md": "by juan"}
    ).json()["id"]

    # Marian (owner) can delete Juan's comment
    r = marian.delete(f"/api/v2/comments/{cid}")
    assert r.status_code == 204

    # And it disappears from listings
    listing = marian.get(f"/api/v2/projects/{pid}/tasks/{tid}/comments").json()
    assert all(c["id"] != cid for c in listing)


def test_comment_isolated_across_projects(signed_in_user, second_user, client_factory) -> None:
    _, marian = signed_in_user
    juan = client_factory()
    juan.get(f"/auth/test-login?email={second_user.email}&name=Juan", follow_redirects=False)
    j_pid, j_tid = _setup(juan, "Juan project")
    cid = juan.post(
        f"/api/v2/projects/{j_pid}/tasks/{j_tid}/comments", json={"body_md": "secret"}
    ).json()["id"]

    # Marian cannot edit/delete Juan's comment in Juan's project
    assert marian.patch(f"/api/v2/comments/{cid}", json={"body_md": "x"}).status_code == 404
    assert marian.delete(f"/api/v2/comments/{cid}").status_code == 404


def test_xss_in_comment_body_sanitized(signed_in_user) -> None:
    _, client = signed_in_user
    pid, tid = _setup(client)
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/comments",
        json={"body_md": "click <script>alert(1)</script>"},
    )
    assert r.status_code == 201
    assert "<script" not in r.json()["body_html"]


def test_empty_comment_rejected(signed_in_user) -> None:
    _, client = signed_in_user
    pid, tid = _setup(client)
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/comments", json={"body_md": "   "}
    )
    assert r.status_code == 422
