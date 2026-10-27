from fastapi.testclient import TestClient


def test_unknown_path_uses_error_format(client: TestClient) -> None:
    response = client.get("/internal/missing", headers={"X-Trace-Id": "t-404"})

    assert response.status_code == 404
    assert response.json() == {
        "code": "COMMON_NOT_FOUND",
        "message": "요청한 주소를 찾을 수 없습니다.",
        "traceId": "t-404",
        "errors": [],
    }


def test_wrong_method_returns_405(client: TestClient) -> None:
    response = client.post("/internal/health")

    assert response.status_code == 405
    assert response.json()["code"] == "COMMON_METHOD_NOT_ALLOWED"
    assert "GET" in response.headers["allow"]


def test_other_client_errors_keep_their_status(client: TestClient) -> None:
    response = client.get("/test/conflict")

    assert response.status_code == 409
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_api_error_uses_its_code(client: TestClient) -> None:
    response = client.get("/test/api-error")

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"
    assert response.json()["message"] == "테스트 오류"


def test_validation_error_lists_fields(client: TestClient) -> None:
    response = client.get("/test/param", params={"size": 0})

    body = response.json()
    assert response.status_code == 400
    assert body["code"] == "COMMON_INVALID_INPUT"
    assert body["errors"][0]["field"] == "size"


def test_unexpected_error_returns_500_with_trace_id(client: TestClient) -> None:
    response = client.get("/test/unexpected", headers={"X-Trace-Id": "t-500"})

    assert response.status_code == 500
    assert response.json() == {
        "code": "COMMON_INTERNAL_ERROR",
        "message": "서버에서 오류가 발생했습니다.",
        "traceId": "t-500",
        "errors": [],
    }
    assert response.headers["X-Trace-Id"] == "t-500"
