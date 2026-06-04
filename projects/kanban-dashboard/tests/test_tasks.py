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


# ---------------------------------------------------------------------------
# P6.1 — Verification column tests
# ---------------------------------------------------------------------------


def test_verification_column_valid(signed_in_user) -> None:
    """PATCH a task's column to 'verification' — response reflects the new column."""
    _, client = signed_in_user
    pid = _new_project(client)
    task = _new_task(client, pid, "Needs review")

    r = client.patch(
        f"/api/v2/projects/{pid}/tasks/{task['id']}",
        json={"title": "Needs review"},
    )
    assert r.status_code == 200

    # Use the move endpoint (the canonical column-change surface)
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{task['id']}/move",
        json={"column": "verification"},
    )
    assert r.status_code == 200
    assert r.json()["column"] == "verification"


def test_verification_column_in_move(signed_in_user) -> None:
    """Move a task from inprogress → verification, then verification → done."""
    _, client = signed_in_user
    pid = _new_project(client)
    task = _new_task(client, pid, "Verify me", column="inprogress")

    # Move to verification
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{task['id']}/move",
        json={"column": "verification"},
    )
    assert r.status_code == 200
    assert r.json()["column"] == "verification"

    # Move on to done
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{task['id']}/move",
        json={"column": "done"},
    )
    assert r.status_code == 200
    assert r.json()["column"] == "done"


def test_verification_column_invalid(signed_in_user) -> None:
    """Moving a task to an unknown column returns 422."""
    _, client = signed_in_user
    pid = _new_project(client)
    task = _new_task(client, pid, "Bad move")

    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{task['id']}/move",
        json={"column": "invalid_col"},
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# P6.2 — Archive tests
# ---------------------------------------------------------------------------


def test_archive_task(signed_in_user) -> None:
    """Archive a Done task: archived_at is set and task disappears from default list."""
    _, client = signed_in_user
    pid = _new_project(client)
    task = _new_task(client, pid, "Done task", column="done")

    r = client.post(f"/api/v2/projects/{pid}/tasks/{task['id']}/archive")
    assert r.status_code == 200
    body = r.json()
    assert body["archived_at"] is not None

    # No longer in the default (active) list
    items = client.get(f"/api/v2/projects/{pid}/tasks").json()["items"]
    assert all(t["id"] != task["id"] for t in items)


def test_archive_task_already_archived(signed_in_user) -> None:
    """Archiving an already-archived task returns 409."""
    _, client = signed_in_user
    pid = _new_project(client)
    task = _new_task(client, pid, "Already done", column="done")

    client.post(f"/api/v2/projects/{pid}/tasks/{task['id']}/archive")
    r = client.post(f"/api/v2/projects/{pid}/tasks/{task['id']}/archive")
    assert r.status_code == 409
    assert r.json()["detail"]["error"]["code"] == "conflict"


def test_archive_task_not_done(signed_in_user) -> None:
    """Archiving a task that is NOT in the done column is allowed (no column restriction)."""
    _, client = signed_in_user
    pid = _new_project(client)
    task = _new_task(client, pid, "In flight", column="inprogress")

    r = client.post(f"/api/v2/projects/{pid}/tasks/{task['id']}/archive")
    assert r.status_code == 200
    assert r.json()["archived_at"] is not None


def test_archived_tasks_hidden_by_default(signed_in_user) -> None:
    """Default GET /tasks excludes archived tasks; only active tasks are returned."""
    _, client = signed_in_user
    pid = _new_project(client)
    active = _new_task(client, pid, "Active")
    to_archive = _new_task(client, pid, "Gone")

    client.post(f"/api/v2/projects/{pid}/tasks/{to_archive['id']}/archive")

    items = client.get(f"/api/v2/projects/{pid}/tasks").json()["items"]
    ids = {t["id"] for t in items}
    assert active["id"] in ids
    assert to_archive["id"] not in ids


def test_archived_tasks_returned_with_flag(signed_in_user) -> None:
    """GET /tasks?archived=true returns only archived tasks."""
    _, client = signed_in_user
    pid = _new_project(client)
    active = _new_task(client, pid, "Active")
    to_archive = _new_task(client, pid, "Archived")

    client.post(f"/api/v2/projects/{pid}/tasks/{to_archive['id']}/archive")

    items = client.get(f"/api/v2/projects/{pid}/tasks?archived=true").json()["items"]
    ids = {t["id"] for t in items}
    assert to_archive["id"] in ids
    assert active["id"] not in ids


def test_unarchive_task(signed_in_user) -> None:
    """Unarchive a task to 'backlog': archived_at cleared, column updated, reappears in list."""
    _, client = signed_in_user
    pid = _new_project(client)
    task = _new_task(client, pid, "Restore me", column="done")

    client.post(f"/api/v2/projects/{pid}/tasks/{task['id']}/archive")

    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{task['id']}/unarchive",
        json={"column": "backlog"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["archived_at"] is None
    assert body["column"] == "backlog"

    # Reappears in the default (active) listing
    items = client.get(f"/api/v2/projects/{pid}/tasks").json()["items"]
    assert any(t["id"] == task["id"] for t in items)


def test_unarchive_task_not_archived(signed_in_user) -> None:
    """Unarchiving a task that is not archived returns 409."""
    _, client = signed_in_user
    pid = _new_project(client)
    task = _new_task(client, pid, "Never archived")

    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{task['id']}/unarchive",
        json={"column": "backlog"},
    )
    assert r.status_code == 409
    assert r.json()["detail"]["error"]["code"] == "conflict"
