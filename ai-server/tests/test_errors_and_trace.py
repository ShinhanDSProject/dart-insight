import logging
from typing import Annotated

import pytest
from fastapi import FastAPI, Query
from fastapi.testclient import TestClient

from app.core.errors import ApiError, ErrorCode
from app.main import create_app


@pytest.fixture
def app() -> FastAPI:
    app = create_app()

    @app.get("/test/api-error")
    def api_error() -> None:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, "테스트 오류")

    @app.get("/test/unexpected")
    def unexpected() -> None:
        raise RuntimeError("예상하지 못한 오류")

    @app.get("/test/param")
    def param(size: Annotated[int, Query(ge=1)]) -> dict[str, int]:
        return {"size": size}

    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def test_trace_id_from_request_is_echoed(client: TestClient) -> None:
    response = client.get("/internal/health", headers={"X-Trace-Id": "abc-123"})

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}
    assert response.headers["X-Trace-Id"] == "abc-123"


def test_trace_id_is_created_when_missing(client: TestClient) -> None:
    response = client.get("/internal/health")

    assert len(response.headers["X-Trace-Id"]) == 16


def test_trace_id_is_written_to_logs(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="app")

    client.get("/internal/health", headers={"X-Trace-Id": "log-trace-1"})

    records = [r for r in caplog.records if r.getMessage() == "AI 서버 상태 확인"]
    assert records
    assert records[0].trace_id == "log-trace-1"


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
