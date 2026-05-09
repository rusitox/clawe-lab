from __future__ import annotations

import io


def _new_project(client) -> str:
    return client.post("/api/v2/projects", json={"name": "Files"}).json()["id"]


def _new_task(client, pid: str, title: str = "T") -> str:
    return client.post(f"/api/v2/projects/{pid}/tasks", json={"title": title}).json()["id"]


def test_upload_and_list(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    tid = _new_task(client, pid)

    payload = b"hello world"
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/attachments",
        files={"file": ("note.txt", io.BytesIO(payload), "text/plain")},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["original_name"] == "note.txt"
    assert body["mime"] == "text/plain"
    assert body["size_bytes"] == len(payload)

    listing = client.get(f"/api/v2/projects/{pid}/tasks/{tid}/attachments").json()
    assert len(listing) == 1


def test_stream_returns_bytes(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    tid = _new_task(client, pid)
    payload = b"streaming-payload"
    aid = client.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/attachments",
        files={"file": ("data.bin", io.BytesIO(payload), "text/plain")},
    ).json()["id"]
    r = client.get(f"/api/v2/attachments/{aid}/raw")
    assert r.status_code == 200
    assert r.content == payload
    assert "X-Content-Type-Options" in r.headers


def test_attachment_isolated_across_projects(signed_in_user, second_user, client_factory) -> None:
    _, marian = signed_in_user
    juan = client_factory()
    juan.get(f"/auth/test-login?email={second_user.email}&name=Juan", follow_redirects=False)
    juan_pid = juan.post("/api/v2/projects", json={"name": "Juan"}).json()["id"]
    juan_tid = juan.post(
        f"/api/v2/projects/{juan_pid}/tasks", json={"title": "secret"}
    ).json()["id"]
    juan_aid = juan.post(
        f"/api/v2/projects/{juan_pid}/tasks/{juan_tid}/attachments",
        files={"file": ("secret.txt", io.BytesIO(b"shh"), "text/plain")},
    ).json()["id"]

    # Marian cannot read metadata
    assert marian.get(f"/api/v2/attachments/{juan_aid}").status_code == 404
    # Nor stream the bytes
    assert marian.get(f"/api/v2/attachments/{juan_aid}/raw").status_code == 404
    # Nor delete
    assert marian.delete(f"/api/v2/attachments/{juan_aid}").status_code == 404


def test_oversized_upload_rejected(signed_in_user, monkeypatch) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    tid = _new_task(client, pid)

    # Force a tiny limit so a normal upload trips the cap.
    from server.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "attachments_max_bytes", 8)

    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/attachments",
        files={"file": ("big.txt", io.BytesIO(b"x" * 16), "text/plain")},
    )
    assert r.status_code == 413
    assert r.json()["detail"]["error"]["code"] == "validation_error"


def test_disallowed_mime_rejected(signed_in_user) -> None:
    _, client = signed_in_user
    pid = _new_project(client)
    tid = _new_task(client, pid)
    r = client.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/attachments",
        files={"file": ("evil.exe", io.BytesIO(b"MZ"), "application/x-msdownload")},
    )
    assert r.status_code == 415


def test_viewer_cannot_upload(signed_in_user, second_user, client_factory) -> None:
    _, owner = signed_in_user
    pid = _new_project(owner)
    tid = _new_task(owner, pid)
    owner.post(
        f"/api/v2/projects/{pid}/members",
        json={"email": second_user.email, "role": "viewer"},
    )
    juan = client_factory()
    juan.get(f"/auth/test-login?email={second_user.email}&name=Juan", follow_redirects=False)
    r = juan.post(
        f"/api/v2/projects/{pid}/tasks/{tid}/attachments",
        files={"file": ("a.txt", io.BytesIO(b"a"), "text/plain")},
    )
    assert r.status_code == 403
