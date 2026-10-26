"""AI 기업 브리핑 내부 API(1.2, ADR-0025). backend가 보고서 하나에서 고른 원문 블록을 보낸다."""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api import paths
from app.api.deps import get_llm_client
from app.briefing.schema import BriefingRequest, output_json
from app.briefing.service import brief
from app.core.errors import ApiError, ErrorCode
from app.llm import LlmClient, LlmUnavailable

router = APIRouter(prefix=paths.INTERNAL_PREFIX, tags=["internal"])
logger = logging.getLogger("app.briefing")


@router.post(paths.BRIEFINGS)
def briefings(
    request: BriefingRequest, llm: Annotated[LlmClient, Depends(get_llm_client)]
) -> dict[str, Any]:
    """근거를 확인한 브리핑 문장과 호출 기록. LLM을 부를 수 없으면 503 AI_LLM_UNAVAILABLE."""
    try:
        briefing = request.to_input()
    except ValueError as e:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, str(e)) from e
    try:
        output = brief(llm, briefing)
    except LlmUnavailable as e:
        raise ApiError(ErrorCode.AI_LLM_UNAVAILABLE, e.message) from e
    logger.info(
        "브리핑 %s(후보 %d건, 문장 %d개) model=%s prompt=%s",
        output.result.status,
        len(briefing.sources),
        len(output.result.sentences),
        output.model,
        output.prompt_version,
    )
    return output_json(output)
