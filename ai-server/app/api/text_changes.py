"""문장·표 변경 탐지 내부 API(2.5). backend가 구조화된 두 원문(4.2)을 보낸다."""

import logging
from typing import Any

from fastapi import APIRouter

from app.api import paths
from app.compare.schema import TextChangeRequest, result_json
from app.compare.service import compare_documents
from app.core.errors import ApiError, ErrorCode

router = APIRouter(prefix=paths.INTERNAL_PREFIX, tags=["internal"])
logger = logging.getLogger("app.compare")


@router.post(paths.TEXT_CHANGES)
def text_changes(request: TextChangeRequest) -> dict[str, Any]:
    """두 원문의 추가·삭제·수정·검토 필요 항목과 확인 우선순위(2.6). 글은 돌려주지 않는다."""
    try:
        previous = request.previous.to_input()
        current = request.current.to_input()
    except ValueError as e:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, str(e)) from e
    compared = compare_documents(previous, current)
    logger.info(
        "문장 비교 %s → %s: 변경 %d건 섹션 %s",
        previous.rcept_no,
        current.rcept_no,
        len(compared.result.changes),
        compared.result.section_counts,
    )
    return result_json(compared.result, compared.priorities)
