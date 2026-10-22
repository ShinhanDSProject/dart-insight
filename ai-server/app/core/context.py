"""요청 범위 값. 웹 프레임워크에 기대지 않아 어느 모듈에서나 가져다 쓸 수 있다."""

from contextvars import ContextVar

trace_id_var: ContextVar[str] = ContextVar("trace_id", default="-")


def current_trace_id() -> str:
    return trace_id_var.get()
