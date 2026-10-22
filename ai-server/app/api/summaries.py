"""근거 기반 요약 내부 API(3.2). backend가 코드로 고른 변화와 근거 후보 원문을 보낸다."""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api.deps import get_llm_client
from app.core.errors import ApiError, ErrorCode
from app.llm import LlmClient, LlmUnavailable
from app.summary.schema import SummaryRequest, output_json
from app.summary.service import summarize

router = APIRouter(prefix="/internal", tags=["internal"])
logger = logging.getLogger("app.summary")


@router.post("/summaries")
def summaries(
    request: SummaryRequest, llm: Annotated[LlmClient, Depends(get_llm_client)]
) -> dict[str, Any]:
    """항목별 요약 문장·설명과 근거 ID, 호출 기록. LLM을 부를 수 없으면 503 AI_LLM_UNAVAILABLE."""
    try:
        summary = request.to_input()
    except ValueError as e:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, str(e)) from e
    try:
        output = summarize(llm, summary)
    except LlmUnavailable as e:
        raise ApiError(ErrorCode.AI_LLM_UNAVAILABLE, e.message) from e
    logger.info(
        "요약 %d건(검토 필요 %d건) model=%s prompt=%s",
        len(output.items),
        sum(1 for i in output.items if i.status != "OK"),
        output.model,
        output.prompt_version,
    )
    return output_json(output)
