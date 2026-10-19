"""환경변수 설정. 값은 ai-server/.env 또는 OS 환경변수에서 읽는다."""

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]

load_dotenv(PROJECT_ROOT / ".env")


def get_dart_api_key() -> str:
    key = os.getenv("DART_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "DART_API_KEY가 설정되지 않았습니다. "
            "ai-server/.env.example을 .env로 복사한 뒤 인증키를 넣어 주세요."
        )
    return key
