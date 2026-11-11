"""내부 API 인증을 포함하는 테스트 HTTP 클라이언트."""

from typing import Any

from fastapi.testclient import TestClient as FastApiTestClient

TEST_INTERNAL_TOKEN = "test-internal-token-that-is-at-least-32-chars"


class TestClient(FastApiTestClient):
    """기존 API 테스트가 운영과 같은 Bearer 인증을 사용하게 한다."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        headers = dict(kwargs.pop("headers", {}))
        headers.setdefault("Authorization", f"Bearer {TEST_INTERNAL_TOKEN}")
        super().__init__(*args, headers=headers, **kwargs)
