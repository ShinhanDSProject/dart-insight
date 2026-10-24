"""근거로 답하기 내부 API(3.10). backend가 질문과 낱말로 찾은 후보 원문·사실 문장을 보낸다."""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.answer.schema import AnswerRequest, output_json
from app.answer.service import answer
from app.api import paths
from app.api.deps import get_llm_client
from app.core.errors import ApiError, ErrorCode
from app.llm import LlmClient, LlmUnavailable

router = APIRouter(prefix=paths.INTERNAL_PREFIX, tags=["internal"])
logger = logging.getLogger("app.answer")


@router.post(paths.ANSWERS)
def answers(
    request: AnswerRequest, llm: Annotated[LlmClient, Depends(get_llm_client)]
) -> dict[str, Any]:
    """인용을 확인한 답과 근거 ID, 호출 기록. LLM을 부를 수 없으면 503 AI_LLM_UNAVAILABLE."""
    try:
        question = request.to_input()
    except ValueError as e:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, str(e)) from e
    try:
        output = answer(llm, question)
    except LlmUnavailable as e:
        raise ApiError(ErrorCode.AI_LLM_UNAVAILABLE, e.message) from e
    logger.info(
        "답 %s(후보 %d건, 사실 %d건) model=%s prompt=%s",
        output.result.status,
        len(question.sources),
        len(question.facts),
        output.model,
        output.prompt_version,
    )
    return output_json(output)
