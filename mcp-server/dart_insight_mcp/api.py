"""backend 공개 API를 부르는 얇은 클라이언트.

쓰기 API는 부르지 않는다(읽기 전용 시제품, ADR-0052).
"""

from __future__ import annotations

import os
import uuid
from typing import Any

import httpx

DEFAULT_BASE_URL = "http://localhost:8090"
TIMEOUT_SECONDS = 15.0


class ApiError(Exception):
    """backend가 4xx·5xx로 답함. code·message는 backend 에러 형식(ADR-0005) 그대로다."""

    def __init__(self, status: int, code: str, message: str, trace_id: str | None):
        super().__init__(f"{code}: {message}")
        self.status = status
        self.code = code
        self.message = message
        self.trace_id = trace_id


class DartInsightApi:
    def __init__(
        self, base_url: str | None = None, transport: httpx.BaseTransport | None = None
    ):
        self._client = httpx.Client(
            base_url=base_url or os.environ.get("DART_INSIGHT_API_URL", DEFAULT_BASE_URL),
            timeout=TIMEOUT_SECONDS,
            transport=transport,
            headers={"Accept": "application/json", "User-Agent": "dart-insight-mcp/0.0.1"},
        )

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        """GET 하고 JSON을 돌려준다.

        값이 None인 쿼리는 빼고, 요청마다 X-Trace-Id를 새로 붙인다.
        """
        query = {k: v for k, v in (params or {}).items() if v is not None}
        trace_id = f"mcp-{uuid.uuid4()}"
        try:
            response = self._client.get(path, params=query, headers={"X-Trace-Id": trace_id})
        except httpx.RequestError as e:
            # 연결 실패·시간 초과도 에이전트가 원인을 알 수 있게 코드와 추적 ID를 붙인다
            message = f"backend에 연결하지 못했어요({type(e).__name__})."
            raise ApiError(0, "MCP_BACKEND_UNREACHABLE", message, trace_id) from e
        if response.status_code >= 400:
            body = _json_or_none(response)
            if not isinstance(body, dict):
                body = {}
            raise ApiError(
                response.status_code,
                body.get("code", "COMMON_UNKNOWN"),
                body.get("message", response.reason_phrase),
                # 에러 본문의 traceId가 backend 로그와 같은 값이다.
                # 없으면 응답 헤더, 그것도 없으면 보낸 값을 쓴다
                body.get("traceId") or response.headers.get("X-Trace-Id", trace_id),
            )
        return response.json()


def _json_or_none(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return None
