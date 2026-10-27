"""요청 추적 ID(X-Trace-Id).

backend가 보낸 X-Trace-Id를 그대로 쓰고, 없으면 새로 만든다. 로그와 에러 응답에 같은 값을 남긴다.
"""

import logging
import re
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.context import current_trace_id, trace_id_var

__all__ = ["TRACE_HEADER", "TraceIdMiddleware", "current_trace_id", "trace_id_var"]

TRACE_HEADER = "X-Trace-Id"
_VALID = re.compile(r"^[A-Za-z0-9-]{1,64}$")

logger = logging.getLogger("app.core")


def resolve_trace_id(header_value: str | None) -> str:
    if header_value and _VALID.match(header_value):
        return header_value
    return uuid.uuid4().hex[:16]


def install_log_record_factory() -> None:
    """모든 로그 레코드에 trace_id 속성을 붙인다(포맷에서 %(trace_id)s로 쓴다)."""
    old_factory = logging.getLogRecordFactory()
    if getattr(old_factory, "_adds_trace_id", False):
        return

    def factory(*args: object, **kwargs: object) -> logging.LogRecord:
        record = old_factory(*args, **kwargs)
        record.trace_id = trace_id_var.get()
        return record

    factory._adds_trace_id = True  # type: ignore[attr-defined]
    logging.setLogRecordFactory(factory)


class TraceIdMiddleware:
    """요청마다 추적 ID를 정해 응답 헤더에 넣고, 처리하지 못한 예외를 공통 에러 형식으로 바꾼다."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        header = None
        for name, value in scope.get("headers", []):
            if name.decode("latin-1").lower() == TRACE_HEADER.lower():
                header = value.decode("latin-1")
                break
        trace_id = resolve_trace_id(header)
        token = trace_id_var.set(trace_id)
        response_started = False

        async def send_with_trace(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                MutableHeaders(scope=message).append(TRACE_HEADER, trace_id)
            await send(message)

        try:
            await self.app(scope, receive, send_with_trace)
        except Exception:
            logger.exception("처리하지 못한 오류")
            if response_started:
                raise
            # 순환 import를 피하려고 여기서 가져온다
            from app.core.errors import ErrorCode, error_response

            response = error_response(ErrorCode.COMMON_INTERNAL_ERROR)
            await response(scope, receive, send_with_trace)
        finally:
            trace_id_var.reset(token)
