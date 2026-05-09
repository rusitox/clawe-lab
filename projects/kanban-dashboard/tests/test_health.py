from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_returns_ok_when_db_up(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["db"] == "up"
    assert "version" in body
