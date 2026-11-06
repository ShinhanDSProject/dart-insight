"""주요 사건 내부 API(2.15, ADR-0050). backend가 분석의 문장 변경을 보낸다."""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.api import paths
from app.api.deps import get_llm_client
from app.api.llm_calls import events_invalid_output, llm_unavailable
from app.core.errors import ApiError, ErrorCode
from app.events.schema import TextEventRequest, output_json
from app.events.service import group_events
from app.events.signals import table_json
from app.llm import LlmClient, LlmOutputInvalid, LlmUnavailable

router = APIRouter(prefix=paths.INTERNAL_PREFIX, tags=["internal"])
logger = logging.getLogger("app.events")


@router.post(paths.TEXT_EVENTS)
def text_events(
    request: TextEventRequest, llm: Annotated[LlmClient, Depends(get_llm_client)]
) -> dict[str, Any]:
    """사건, 묶이지 않은 후보, 호출 기록.

    쓸 수 있는 사건이 없으면 502 AI_EVENTS_INVALID_OUTPUT, LLM을 부를 수 없으면
    503 AI_LLM_UNAVAILABLE. 그때까지의 호출 기록은 X-Llm-Calls 헤더(ADR-0042).
    """
    try:
        event_input = request.to_input()
    except ValueError as e:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, str(e)) from e
    try:
        output = group_events(llm, event_input)
    except LlmOutputInvalid as e:
        raise events_invalid_output(e) from e
    except LlmUnavailable as e:
        raise llm_unavailable(e) from e
    logger.info(
        "사건 %d건(뺀 사건 %d건, 묶이지 않은 후보 %d건) reason=%s model=%s prompt=%s",
        len(output.events),
        output.dropped_event_count,
        len(output.unbound_change_nos),
        output.not_created_reason,
        output.model,
        output.prompt_version,
    )
    return output_json(output, event_input)


@router.get(paths.SIGNAL_TABLES)
def signal_table() -> dict[str, Any]:
    """지금 쓰는 사건 신호 기준표. 출처를 확인하지 못한 용어는 빼고 준다(ADR-0060)."""
    return table_json()
