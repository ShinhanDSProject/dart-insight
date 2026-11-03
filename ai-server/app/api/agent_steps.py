"""에이전트 한 단계 내부 API(ADR-0044·0045).

backend가 Tool·액션 목록과 지금까지의 Tool 결과를 보낸다.
"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.agent.schema import StepRequest, output_json
from app.agent.service import run_step
from app.api import paths
from app.api.deps import get_llm_client
from app.api.llm_calls import llm_unavailable
from app.core.errors import ApiError, ErrorCode
from app.llm import LlmClient, LlmUnavailable

router = APIRouter(prefix=paths.INTERNAL_PREFIX, tags=["internal"])
logger = logging.getLogger("app.agent")


@router.post(paths.AGENT_STEPS)
def agent_steps(
    request: StepRequest, llm: Annotated[LlmClient, Depends(get_llm_client)]
) -> dict[str, Any]:
    """다음에 부를 Tool 또는 검토를 통과한 최종 답, 호출 기록.

    LLM을 부를 수 없으면 503 AI_LLM_UNAVAILABLE. 그때까지의 호출 기록은 X-Llm-Calls 헤더(ADR-0042).
    """
    try:
        step = request.to_input()
    except ValueError as e:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, str(e)) from e
    try:
        output = run_step(llm, step)
    except LlmUnavailable as e:
        raise llm_unavailable(e) from e
    logger.info(
        "에이전트 단계 %s(Tool 결과 %d건, 남은 왕복 %d, 반려 %d) model=%s prompt=%s",
        output.kind,
        len(step.tool_results),
        step.remaining_steps,
        len(output.rejections),
        output.model,
        output.prompt_version,
    )
    return output_json(output)
