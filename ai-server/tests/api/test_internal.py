from fastapi.testclient import TestClient

from app.main import create_app

TOKEN = "test-internal-token-that-is-at-least-32-chars"
AUTHORIZATION = {"Authorization": f"Bearer {TOKEN}"}


def test_internal_health_returns_up() -> None:
    client = TestClient(create_app(internal_token=TOKEN))

    response = client.get("/internal/health", headers=AUTHORIZATION)

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_internal_health_rejects_other_methods_in_error_format() -> None:
    client = TestClient(create_app(internal_token=TOKEN))

    response = client.post("/internal/health", headers=AUTHORIZATION)

    assert response.status_code == 405
    assert response.json()["code"] == "COMMON_METHOD_NOT_ALLOWED"


def test_internal_health_rejects_missing_token() -> None:
    client = TestClient(create_app(internal_token=TOKEN))

    response = client.get("/internal/health")

    assert response.status_code == 401
    assert response.json()["code"] == "AI_INTERNAL_UNAUTHORIZED"
    assert TOKEN not in response.text


def test_internal_health_rejects_wrong_token() -> None:
    client = TestClient(create_app(internal_token=TOKEN))

    response = client.get(
        "/internal/health",
        headers={"Authorization": "Bearer wrong-token-that-is-also-not-logged"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "AI_INTERNAL_UNAUTHORIZED"


def test_public_health_does_not_require_internal_token() -> None:
    client = TestClient(create_app(internal_token=TOKEN))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}
