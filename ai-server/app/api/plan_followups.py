"""약속과 실제 대조 내부 API(1.10, ADR-0041).

backend가 작년 사업보고서의 계획과 계획마다 올해 사업보고서에서 고른 후보 문단을 보낸다.
"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api import paths
from app.api.deps import get_llm_client
from app.core.errors import ApiError, ErrorCode
from app.followup.schema import FollowupRequest, output_json
from app.followup.service import compare
from app.llm import LlmClient, LlmUnavailable

router = APIRouter(prefix=paths.INTERNAL_PREFIX, tags=["internal"])
logger = logging.getLogger("app.followup")


@router.post(paths.PLAN_FOLLOWUPS)
def plan_followups(
    request: FollowupRequest, llm: Annotated[LlmClient, Depends(get_llm_client)]
) -> dict[str, Any]:
    """계획마다 근거를 확인한 대조와 호출 기록. LLM을 부를 수 없으면 503 AI_LLM_UNAVAILABLE."""
    try:
        followup = request.to_input()
    except ValueError as e:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, str(e)) from e
    try:
        output = compare(llm, followup)
    except LlmUnavailable as e:
        raise ApiError(ErrorCode.AI_LLM_UNAVAILABLE, e.message) from e
    logger.info(
        "약속과 실제 대조 %s(계획 %d개, 후보 %d건) model=%s prompt=%s",
        output.result.status,
        len(followup.plans),
        sum(len(p.candidates) for p in followup.plans),
        output.model,
        output.prompt_version,
    )
    return output_json(output)
