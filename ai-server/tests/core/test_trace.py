import logging

import pytest
from fastapi.testclient import TestClient


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
