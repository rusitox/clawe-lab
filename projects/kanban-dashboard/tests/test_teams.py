from __future__ import annotations


def _new_project(client) -> str:
    return client.post("/api/v2/projects", json={"name": "Project"}).json()["id"]


def test_create_list_team(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)

    r = client.post(
        f"/api/v2/projects/{pid}/teams",
        json={"name": "Frontend", "color": "#3b5bdb"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "Frontend"
    assert body["color"] == "#3b5bdb"

    listing = client.get(f"/api/v2/projects/{pid}/teams").json()
    assert len(listing) == 1


def test_team_color_must_be_hex(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    r = client.post(
        f"/api/v2/projects/{pid}/teams",
        json={"name": "Bad", "color": "blue"},
    )
    assert r.status_code == 422


def test_duplicate_team_name_409(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    client.post(f"/api/v2/projects/{pid}/teams", json={"name": "X", "color": "#ff0000"})
    r = client.post(f"/api/v2/projects/{pid}/teams", json={"name": "X", "color": "#00ff00"})
    assert r.status_code == 409


def test_team_isolated_per_project(signed_in_user) -> None:
    _, client = signed_in_user
    p1 = _new_project(client)
    p2 = client.post("/api/v2/projects", json={"name": "Other"}).json()["id"]
    client.post(f"/api/v2/projects/{p1}/teams", json={"name": "T", "color": "#abcdef"})
    rows = client.get(f"/api/v2/projects/{p2}/teams").json()
    assert rows == []


def test_team_404_under_wrong_project(signed_in_user) -> None:
    _, client = signed_in_user
    p1 = _new_project(client)
    p2 = client.post("/api/v2/projects", json={"name": "Other"}).json()["id"]
    team = client.post(
        f"/api/v2/projects/{p1}/teams", json={"name": "T", "color": "#abcdef"}
    ).json()
    r = client.patch(
        f"/api/v2/projects/{p2}/teams/{team['id']}", json={"name": "renamed"}
    )
    assert r.status_code == 404
