"""두 보고서 사이 활동과 앞으로의 영향 내부 API(ADR-0067).

backend가 한 분석의 분류된 문장 변경을 보낸다. 후보 고르기는 ai-server가 한다.
"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.activity.schema import ActivityRequest, output_json
from app.activity.service import summarize
from app.api import paths
from app.api.deps import get_llm_client
from app.core.errors import ApiError, ErrorCode
from app.llm import LlmClient, LlmUnavailable

router = APIRouter(prefix=paths.INTERNAL_PREFIX, tags=["internal"])
logger = logging.getLogger("app.activity")


@router.post(paths.PERIOD_ACTIVITIES)
def period_activities(
    request: ActivityRequest, llm: Annotated[LlmClient, Depends(get_llm_client)]
) -> dict[str, Any]:
    """근거를 확인한 활동 카드와 호출 기록. LLM을 부를 수 없으면 503 AI_LLM_UNAVAILABLE."""
    try:
        activity = request.to_input()
    except ValueError as e:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, str(e)) from e
    try:
        output = summarize(llm, activity)
    except LlmUnavailable as e:
        raise ApiError(ErrorCode.AI_LLM_UNAVAILABLE, e.message) from e
    logger.info(
        "활동·영향 %s(변경 %d건, 후보 %d건, 원문 %d개, 카드 %d개, 뺌 %d) model=%s prompt=%s",
        output.result.status,
        len(request.changes),
        activity.candidate_count,
        len(activity.sources),
        len(output.result.items),
        output.result.dropped_count,
        output.model,
        output.prompt_version,
    )
    return output_json(output)
