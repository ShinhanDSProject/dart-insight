"""회사가 밝힌 전망·계획 내부 API(1.9, ADR-0039).

backend가 사업보고서 하나에서 고른 원문 문단을 보낸다.
"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api import paths
from app.api.deps import get_llm_client
from app.core.errors import ApiError, ErrorCode
from app.llm import LlmClient, LlmUnavailable
from app.outlook.schema import OutlookRequest, output_json
from app.outlook.service import extract

router = APIRouter(prefix=paths.INTERNAL_PREFIX, tags=["internal"])
logger = logging.getLogger("app.outlook")


@router.post(paths.OUTLOOKS)
def outlooks(
    request: OutlookRequest, llm: Annotated[LlmClient, Depends(get_llm_client)]
) -> dict[str, Any]:
    """근거를 확인한 전망·계획 항목과 호출 기록. LLM을 부를 수 없으면 503 AI_LLM_UNAVAILABLE."""
    try:
        outlook = request.to_input()
    except ValueError as e:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, str(e)) from e
    try:
        output = extract(llm, outlook)
    except LlmUnavailable as e:
        raise ApiError(ErrorCode.AI_LLM_UNAVAILABLE, e.message) from e
    logger.info(
        "전망·계획 %s(후보 %d건, 항목 %d개) model=%s prompt=%s",
        output.result.status,
        len(outlook.sources),
        len(output.result.items),
        output.model,
        output.prompt_version,
    )
    return output_json(output)
