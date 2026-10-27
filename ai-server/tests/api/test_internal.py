from fastapi.testclient import TestClient

from app.main import create_app


def test_internal_health_returns_up() -> None:
    client = TestClient(create_app())

    response = client.get("/internal/health")

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_internal_health_rejects_other_methods_in_error_format() -> None:
    client = TestClient(create_app())

    response = client.post("/internal/health")

    assert response.status_code == 405
    assert response.json()["code"] == "COMMON_METHOD_NOT_ALLOWED"
