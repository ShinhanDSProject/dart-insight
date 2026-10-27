"""core 테스트 공용 앱: 에러 형식을 확인할 시험용 경로를 붙인다."""

from typing import Annotated

import pytest
from fastapi import FastAPI, HTTPException, Query
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

    @app.get("/test/conflict")
    def conflict() -> None:
        raise HTTPException(status_code=409, detail="충돌")

    @app.get("/test/param")
    def param(size: Annotated[int, Query(ge=1)]) -> dict[str, int]:
        return {"size": size}

    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app, raise_server_exceptions=False)
