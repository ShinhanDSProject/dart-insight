"""환경변수 설정.

값은 실행할 때 환경변수(또는 `uvicorn --env-file .env`)로 넣고 코드·저장소에 쓰지 않는다.
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class LlmSettings:
    """LLM 호출 설정(0.7).

    provider: 제공자 이름. `openai`(ADR-0026) 또는 `fake`(테스트·개발용 가짜 응답).
        비어 있으면 LLM을 쓰지 않는다(호출하면 실패).
    model: 모델 이름. 호출 기록에 남는다. 비우면 제공자의 기본 모델.
    api_key: 제공자 인증키. 로그·응답에 남기지 않는다.
    reasoning_effort: 추론 모델의 추론 강도(`reasoning.effort`, 예: low·medium·high).
        비우면 보내지 않고 모델 기본값을 쓴다. 모델마다 지원하는 값이 다르다.
    timeout_seconds: 한 번 호출의 응답 대기 시간.
    max_retries: 네트워크 오류·시간 초과·제공자 일시 오류일 때 다시 시도하는 횟수.
    max_output_retries: 결과 형식·검증에 실패했을 때 다시 생성하는 횟수(AGENTS.md: 최대 2회).
    total_timeout_seconds: 요청 하나(재시도·다시 생성 포함)에 쓰는 전체 시간.
        backend의 AI 서버 응답 대기 시간(180초)보다 짧아야 호출 기록이 backend에 돌아간다.
    """

    provider: str = ""
    model: str = ""
    api_key: str | None = None
    reasoning_effort: str | None = None
    timeout_seconds: float = 60.0
    max_retries: int = 2
    max_output_retries: int = 2
    total_timeout_seconds: float = 120.0


def _int(name: str, default: int) -> int:
    value = os.environ.get(name, "").strip()
    return int(value) if value else default


def _float(name: str, default: float) -> float:
    value = os.environ.get(name, "").strip()
    return float(value) if value else default


def load_llm_settings() -> LlmSettings:
    return LlmSettings(
        provider=os.environ.get("LLM_PROVIDER", "").strip().lower(),
        model=os.environ.get("LLM_MODEL", "").strip(),
        api_key=os.environ.get("LLM_API_KEY", "").strip() or None,
        reasoning_effort=os.environ.get("LLM_REASONING_EFFORT", "").strip().lower() or None,
        timeout_seconds=_float("LLM_TIMEOUT_SECONDS", 60.0),
        max_retries=_int("LLM_MAX_RETRIES", 2),
        max_output_retries=min(_int("LLM_MAX_OUTPUT_RETRIES", 2), 2),
        total_timeout_seconds=_float("LLM_TOTAL_TIMEOUT_SECONDS", 120.0),
    )
