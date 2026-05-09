from __future__ import annotations


def _new_project(client, name: str = "Clawe HQ") -> str:
    return client.post("/api/v2/projects", json={"name": name}).json()["id"]


def _new_task(client, pid: str, title: str = "Hello", **kwargs) -> dict:
    body = {"title": title, **kwargs}
    r = client.post(f"/api/v2/projects/{pid}/tasks", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_and_list_task(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    task = _new_task(client, pid, "First task", kind="task", priority="P1")
    assert task["title"] == "First task"
    assert task["kind"] == "task"
    assert task["column"] == "backlog"
    assert task["priority"] == "P1"

    listing = client.get(f"/api/v2/projects/{pid}/tasks").json()
    assert len(listing["items"]) == 1
    assert listing["items"][0]["id"] == task["id"]


def test_filter_by_kind_and_column(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    _new_task(client, pid, "Task A", kind="task")
    _new_task(client, pid, "Bug A", kind="bug", column="todo")
    _new_task(client, pid, "Proposal A", kind="proposal", column="todo")

    bugs = client.get(f"/api/v2/projects/{pid}/tasks?kind=bug").json()["items"]
    assert len(bugs) == 1 and bugs[0]["title"] == "Bug A"

    todo = client.get(f"/api/v2/projects/{pid}/tasks?column=todo").json()["items"]
    assert {t["title"] for t in todo} == {"Bug A", "Proposal A"}


def test_filter_by_label(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    _new_task(client, pid, "A", labels=["frontend", "p0"])
    _new_task(client, pid, "B", labels=["backend"])
    _new_task(client, pid, "C", labels=[])

    rows = client.get(f"/api/v2/projects/{pid}/tasks?label=frontend").json()["items"]
    assert [r["title"] for r in rows] == ["A"]


def test_move_task_changes_column_and_position(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    a = _new_task(client, pid, "A")
    _new_task(client, pid, "B")  # both in backlog, B after A

    # move A to todo (top)
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{a['id']}/move",
        json={"column": "todo"},
    )
    assert r.status_code == 200
    moved = r.json()
    assert moved["column"] == "todo"

    # B remains in backlog
    backlog = client.get(f"/api/v2/projects/{pid}/tasks?column=backlog").json()["items"]
    assert [t["title"] for t in backlog] == ["B"]


def test_move_between_two_anchors_picks_intermediate_position(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    a = _new_task(client, pid, "A", column="todo")
    b = _new_task(client, pid, "B", column="todo")
    c = _new_task(client, pid, "C", column="todo")

    # move C between A and B
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{c['id']}/move",
        json={"column": "todo", "after_task_id": a["id"], "before_task_id": b["id"]},
    )
    assert r.status_code == 200
    rows = client.get(f"/api/v2/projects/{pid}/tasks?column=todo").json()["items"]
    assert [t["title"] for t in rows] == ["A", "C", "B"]


def test_update_task_fields(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    t = _new_task(client, pid, "First")

    r = client.patch(
        f"/api/v2/projects/{pid}/tasks/{t['id']}",
        json={"title": "Renamed", "priority": "P0", "kind": "bug"},
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["title"] == "Renamed"
    assert updated["priority"] == "P0"
    assert updated["kind"] == "bug"


def test_soft_delete_hides_task(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    t = _new_task(client, pid, "Doomed")
    assert client.delete(f"/api/v2/projects/{pid}/tasks/{t['id']}").status_code == 204
    rows = client.get(f"/api/v2/projects/{pid}/tasks").json()["items"]
    assert all(r["id"] != t["id"] for r in rows)
    # And get returns 404
    assert client.get(f"/api/v2/projects/{pid}/tasks/{t['id']}").status_code == 404


def test_task_isolation_across_projects(signed_in_user, second_user, client_factory) -> None:
    """A task in another user's project is invisible (404)."""
    _, client = signed_in_user
    juan = client_factory()
    juan.get(f"/auth/test-login?email={second_user.email}&name=Juan", follow_redirects=False)

    juan_pid = juan.post("/api/v2/projects", json={"name": "Juan secret"}).json()["id"]
    juan_task = _new_task(juan, juan_pid, "Juan secret task")

    # Marian cannot see Juan's task list
    assert client.get(f"/api/v2/projects/{juan_pid}/tasks").status_code == 404
    # Nor the specific task
    assert client.get(f"/api/v2/projects/{juan_pid}/tasks/{juan_task['id']}").status_code == 404
    # Nor mutate it
    assert client.patch(
        f"/api/v2/projects/{juan_pid}/tasks/{juan_task['id']}", json={"title": "hijacked"}
    ).status_code == 404
    assert client.delete(f"/api/v2/projects/{juan_pid}/tasks/{juan_task['id']}").status_code == 404


def test_viewer_cannot_mutate(signed_in_user, second_user, client_factory) -> None:
    _, client = signed_in_user
    pid = _new_project(client, "Shared")
    client.post(
        f"/api/v2/projects/{pid}/members",
        json={"email": second_user.email, "role": "viewer"},
    )
    juan = client_factory()
    juan.get(f"/auth/test-login?email={second_user.email}&name=Juan", follow_redirects=False)

    # Juan can read
    assert juan.get(f"/api/v2/projects/{pid}/tasks").status_code == 200
    # But not create
    r = juan.post(f"/api/v2/projects/{pid}/tasks", json={"title": "nope"})
    assert r.status_code == 403
    assert r.json()["detail"]["error"]["code"] == "unauthorized"


def test_validation_invalid_kind(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    r = client.post(f"/api/v2/projects/{pid}/tasks", json={"title": "x", "kind": "epic"})
    assert r.status_code == 422
