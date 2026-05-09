"""API token lifecycle tests.

Covers create / list / revoke + bearer-token auth on /api/v2/me.
"""
from __future__ import annotations

import pytest


def test_unauthenticated_me_returns_401(client) -> None:
    r = client.get("/api/v2/me")
    assert r.status_code == 401
    body = r.json()
    assert body["detail"]["error"]["code"] == "unauthenticated"


def test_create_list_revoke_token(signed_in_user) -> None:
    user, client = signed_in_user

    create = client.post("/api/v2/tokens", json={"name": "openclaw-prod"})
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["name"] == "openclaw-prod"
    plaintext = body["plaintext"]
    assert plaintext.startswith("kbn_")
    prefix = body["prefix"]
    assert plaintext.startswith(prefix)
    token_id = body["id"]

    listing = client.get("/api/v2/tokens")
    assert listing.status_code == 200
    rows = listing.json()
    assert len(rows) == 1
    assert "plaintext" not in rows[0]
    assert rows[0]["prefix"] == prefix
    assert rows[0]["revoked_at"] is None

    revoke = client.delete(f"/api/v2/tokens/{token_id}")
    assert revoke.status_code == 204

    after = client.get("/api/v2/tokens")
    assert any(row["id"] == token_id and row["revoked_at"] for row in after.json())


def test_bearer_token_authenticates_me(signed_in_user) -> None:
    user, client = signed_in_user
    create = client.post("/api/v2/tokens", json={"name": "openclaw-prod"})
    plaintext = create.json()["plaintext"]

    fresh_client = type(client)(client.app)
    r = fresh_client.get(
        "/api/v2/me", headers={"Authorization": f"Bearer {plaintext}"}
    )
    assert r.status_code == 200
    assert r.json()["email"] == user.email


def test_revoked_token_cannot_authenticate(signed_in_user) -> None:
    user, client = signed_in_user
    create = client.post("/api/v2/tokens", json={"name": "throwaway"})
    plaintext = create.json()["plaintext"]
    token_id = create.json()["id"]

    client.delete(f"/api/v2/tokens/{token_id}")

    fresh_client = type(client)(client.app)
    r = fresh_client.get(
        "/api/v2/me", headers={"Authorization": f"Bearer {plaintext}"}
    )
    assert r.status_code == 401


def test_bearer_cannot_create_new_token(signed_in_user) -> None:
    """A bearer token must not be able to mint sibling tokens.

    Tokens are minted only from a real cookie session — see
    server/api/v2/tokens.py::_require_session_cookie.
    """
    user, client = signed_in_user
    plaintext = client.post("/api/v2/tokens", json={"name": "boot"}).json()["plaintext"]

    fresh_client = type(client)(client.app)
    r = fresh_client.post(
        "/api/v2/tokens",
        json={"name": "child"},
        headers={"Authorization": f"Bearer {plaintext}"},
    )
    assert r.status_code == 403
    assert r.json()["detail"]["error"]["code"] == "unauthorized"


def test_invalid_token_format_is_401(client) -> None:
    r = client.get("/api/v2/me", headers={"Authorization": "Bearer not-a-token"})
    assert r.status_code == 401


@pytest.mark.parametrize("name", ["", "  "])
def test_token_name_required(signed_in_user, name: str) -> None:
    _, client = signed_in_user
    r = client.post("/api/v2/tokens", json={"name": name})
    assert r.status_code == 422
