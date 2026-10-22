"""backend(Spring Boot)만 부르는 내부 API. 외부에 열지 않는다."""

import logging

from fastapi import APIRouter

from app.api import paths

router = APIRouter(prefix=paths.INTERNAL_PREFIX, tags=["internal"])
logger = logging.getLogger("app.internal")


@router.get(paths.INTERNAL_HEALTH)
def internal_health() -> dict[str, str]:
    logger.info("AI 서버 상태 확인")
    return {"status": "UP"}
