"""API에서 쓰는 공용 의존성."""

from fastapi import Request

from app.llm import LlmClient


def get_llm_client(request: Request) -> LlmClient:
    return request.app.state.llm_client
