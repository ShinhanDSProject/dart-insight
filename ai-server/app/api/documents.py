"""원문 구조화 내부 API(4.2). backend가 OpenDART에서 받은 원문 ZIP을 그대로 보낸다."""

import logging
import re
from typing import Any

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool

from app.api import paths
from app.core.errors import ApiError, ErrorCode
from app.documents.parser import PARSER_VERSION, structure_zip
from app.documents.schema import document_json

router = APIRouter(prefix=paths.DOCUMENTS_PREFIX, tags=["internal"])
logger = logging.getLogger("app.documents")

MAX_ZIP_BYTES = 80 * 1024 * 1024
_RCEPT_NO = re.compile(r"^\d{14}$")


@router.get(paths.DOCUMENT_PARSER)
def parser_info() -> dict[str, str]:
    """지금 쓰는 파서 버전. backend가 저장된 구조와 버전이 다르면 다시 구조화한다."""
    return {"parserVersion": PARSER_VERSION}


@router.post(paths.DOCUMENT_STRUCTURE)
async def structure(rcept_no: str, request: Request) -> dict[str, Any]:
    """본문은 ZIP 바이트(application/zip). 읽지 못해도 200과 status=FAILED, 사유를 돌려준다."""
    if not _RCEPT_NO.match(rcept_no):
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, "접수번호는 14자리 숫자입니다.")
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > MAX_ZIP_BYTES:
        raise ApiError(ErrorCode.AI_DOCUMENT_TOO_LARGE)  # 본문을 읽기 전에 거절한다
    body = await request.body()
    if not body:
        raise ApiError(ErrorCode.COMMON_INVALID_INPUT, "원문 ZIP이 비어 있습니다.")
    if len(body) > MAX_ZIP_BYTES:
        raise ApiError(ErrorCode.AI_DOCUMENT_TOO_LARGE)
    document = await run_in_threadpool(structure_zip, rcept_no, body)
    logger.info(
        "원문 구조화 %s: %s 섹션 %d 블록 %d 경고 %s",
        rcept_no,
        document.status,
        len(document.sections),
        len(document.blocks),
        [w.code for w in document.warnings] or "-",
    )
    return document_json(document)
