"""공통 에러 형식. backend(Spring Boot)와 같은 모양을 쓴다(docs/api-spec.md 0절).

{"code": "...", "message": "...", "traceId": "...", "errors": [{"field": "...", "reason": "..."}]}
"""

from enum import Enum

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.trace import current_trace_id


class ErrorCode(Enum):
    COMMON_INVALID_INPUT = (400, "입력값을 확인해 주세요.")
    COMMON_NOT_FOUND = (404, "요청한 주소를 찾을 수 없습니다.")
    COMMON_METHOD_NOT_ALLOWED = (405, "지원하지 않는 요청 방식입니다.")
    COMMON_INTERNAL_ERROR = (500, "서버에서 오류가 발생했습니다.")

    def __init__(self, status: int, default_message: str) -> None:
        self.status = status
        self.default_message = default_message


class ApiError(Exception):
    """정해진 에러 코드로 응답할 때 던진다."""

    def __init__(self, code: ErrorCode, message: str | None = None) -> None:
        super().__init__(message or code.default_message)
        self.code = code
        self.message = message or code.default_message


def error_response(
    code: ErrorCode,
    message: str | None = None,
    errors: list[dict[str, str]] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=code.status,
        content={
            "code": code.name,
            "message": message or code.default_message,
            "traceId": current_trace_id(),
            "errors": errors or [],
        },
    )


_STATUS_TO_CODE = {
    400: ErrorCode.COMMON_INVALID_INPUT,
    404: ErrorCode.COMMON_NOT_FOUND,
    405: ErrorCode.COMMON_METHOD_NOT_ALLOWED,
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = []
        for error in exc.errors():
            location = [str(part) for part in error.get("loc", ())]
            field = ".".join(location[1:]) if len(location) > 1 else ".".join(location)
            errors.append({"field": field, "reason": error.get("msg", "")})
        return error_response(ErrorCode.COMMON_INVALID_INPUT, errors=errors)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_TO_CODE.get(exc.status_code, ErrorCode.COMMON_INTERNAL_ERROR)
        return error_response(code)
