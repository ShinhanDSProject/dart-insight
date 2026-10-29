"""실패한 요청의 LLM 호출 기록을 에러 응답 헤더로 넘기기(#137, ADR-0042).

에러 본문은 공통 형식({code, message, traceId, errors}) 그대로 두고, 그때까지 부른 기록을
X-Llm-Calls 헤더에 담는다. 값은 200 응답의 calls와 같은 객체 배열의 UTF-8 JSON을
base64url로 바꾼 글자다.
"""

import base64
import json

from app.core.errors import ApiError, ErrorCode
from app.llm import CallRecord, LlmUnavailable

LLM_CALLS_HEADER = "X-Llm-Calls"


def encode_calls(calls: list[CallRecord]) -> str:
    data = json.dumps([c.to_dict() for c in calls], ensure_ascii=False, separators=(",", ":"))
    return base64.urlsafe_b64encode(data.encode("utf-8")).decode("ascii")


def llm_unavailable(e: LlmUnavailable) -> ApiError:
    """503 AI_LLM_UNAVAILABLE. 호출 기록이 있으면 X-Llm-Calls 헤더에 담는다(없으면 헤더 없음)."""
    headers = {LLM_CALLS_HEADER: encode_calls(e.calls)} if e.calls else None
    return ApiError(ErrorCode.AI_LLM_UNAVAILABLE, e.message, headers=headers)
