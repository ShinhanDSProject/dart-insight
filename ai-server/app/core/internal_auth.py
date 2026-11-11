"""backend에서 오는 내부 API 요청 인증(ADR-0067)."""

import os
import secrets
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Header

from app.core.errors import ApiError, ErrorCode

MIN_TOKEN_LENGTH = 32


def validate_internal_token(token: str) -> str:
    """내부 인증 토큰을 검사한다. 짧은 토큰이면 서버 시작을 막는다."""
    token = token.strip()
    if len(token) < MIN_TOKEN_LENGTH:
        raise ValueError(f"AI_INTERNAL_TOKEN은 {MIN_TOKEN_LENGTH}자 이상이어야 합니다.")
    return token


def load_internal_token() -> str:
    """환경변수의 내부 인증 토큰을 읽는다. 안전하지 않은 설정이면 서버 시작을 막는다."""
    return validate_internal_token(os.environ.get("AI_INTERNAL_TOKEN", ""))


def internal_auth_dependency(expected_token: str) -> Callable[..., Awaitable[None]]:
    """`/internal/**` 라우터에 붙일 Bearer 토큰 검사 의존성."""

    async def require_internal_auth(
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        if authorization is None:
            raise ApiError(ErrorCode.AI_INTERNAL_UNAUTHORIZED)
        scheme, separator, provided_token = authorization.partition(" ")
        if not separator or scheme.lower() != "bearer":
            raise ApiError(ErrorCode.AI_INTERNAL_UNAUTHORIZED)
        if not provided_token or not secrets.compare_digest(provided_token, expected_token):
            raise ApiError(ErrorCode.AI_INTERNAL_UNAUTHORIZED)

    return require_internal_auth
