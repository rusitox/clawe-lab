from __future__ import annotations


def test_activity_feed_records_project_and_task_events(signed_in_user) -> None:
    _, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "Feed"}).json()["id"]
    t = client.post(
        f"/api/v2/projects/{pid}/tasks", json={"title": "Hello"}
    ).json()
    client.post(
        f"/api/v2/projects/{pid}/tasks/{t['id']}/move", json={"column": "todo"}
    )

    feed = client.get(f"/api/v2/projects/{pid}/activity").json()
    kinds = [e["kind"] for e in feed["items"]]
    # newest first
    assert kinds[:3] == ["task.moved", "task.created", "project.created"]


def test_activity_pagination(signed_in_user) -> None:
    _, client = signed_in_user
    pid = client.post("/api/v2/projects", json={"name": "Pagi"}).json()["id"]
    for i in range(7):
        client.post(f"/api/v2/projects/{pid}/tasks", json={"title": f"T{i}"})

    page1 = client.get(f"/api/v2/projects/{pid}/activity?limit=3").json()
    assert len(page1["items"]) == 3
    assert page1["next_cursor"] is not None

    page2 = client.get(
        f"/api/v2/projects/{pid}/activity?limit=3&cursor={page1['next_cursor']}"
    ).json()
    assert len(page2["items"]) == 3
    # No overlap
    ids1 = {e["id"] for e in page1["items"]}
    ids2 = {e["id"] for e in page2["items"]}
    assert not (ids1 & ids2)


def test_activity_isolated_per_project(signed_in_user) -> None:
    _, client = signed_in_user
    p1 = client.post("/api/v2/projects", json={"name": "P1"}).json()["id"]
    p2 = client.post("/api/v2/projects", json={"name": "P2"}).json()["id"]
    client.post(f"/api/v2/projects/{p1}/tasks", json={"title": "in-p1"})
    feed_p2 = client.get(f"/api/v2/projects/{p2}/activity").json()
    # p2 only has the project.created event for itself
    titles_in_payload = [e["payload"].get("title") for e in feed_p2["items"]]
    assert "in-p1" not in titles_in_payload
