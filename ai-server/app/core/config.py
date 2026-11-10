"""환경변수 설정.

값은 실행할 때 환경변수(또는 `uvicorn --env-file .env`)로 넣고 코드·저장소에 쓰지 않는다.
"""

import os
from dataclasses import dataclass, field

# 제공자별 작업별 모델의 기본값(ADR-0059·ADR-0062·ADR-0063). LLM_TASK_MODELS가 없으면 이 값을 쓰고,
# 빈 값이면 작업별 모델을 쓰지 않는다. 여기 없는 제공자는 작업별 모델을 쓰지 않는다.
# Claude는 에이전트 Tool 고르기와 주요 사건 작업 4개(묶기·금액 확인·공시의 의미·신호 이유)가 Haiku다
DEFAULT_TASK_MODELS = {
    "anthropic": (
        "agent_plan=claude-haiku-5-5,"
        "text_event=claude-haiku-5-5,"
        "event_amount_pick=claude-haiku-5-5,"
        "event_meaning=claude-haiku-5-5,"
        "event_signal_reason=claude-haiku-5-5"
    ),
    "openai": "agent_plan=gpt-6-luna",
}


@dataclass(frozen=True)
class LlmSettings:
    """LLM 호출 설정(0.7).

    provider: 제공자 이름. `anthropic`(ADR-0062), `openai`(ADR-0026),
        `fake`(테스트·개발용 가짜 응답).
        비어 있으면 LLM을 쓰지 않는다(호출하면 실패).
    model: 모델 이름. 호출 기록에 남는다. 비우면 제공자의 기본 모델.
    api_key: 제공자 인증키. 로그·응답에 남기지 않는다.
    reasoning_effort: 추론 강도(예: low·medium·high). OpenAI는 `reasoning.effort`,
        Anthropic은 `output_config.effort`로 보낸다.
        비우면 보내지 않고 모델 기본값을 쓴다. 모델마다 지원하는 값이 다르다.
    timeout_seconds: 한 번 호출의 응답 대기 시간.
    max_retries: 네트워크 오류·시간 초과·제공자 일시 오류일 때 다시 시도하는 횟수.
    max_output_retries: 결과 형식·검증에 실패했을 때 다시 생성하는 횟수(AGENTS.md: 최대 2회).
    total_timeout_seconds: 요청 하나(재시도·다시 생성 포함)에 쓰는 전체 시간.
        backend의 AI 서버 응답 대기 시간(180초)보다 짧아야 호출 기록이 backend에 돌아간다.
    task_models: 작업(task) → 모델 ID. 여기 있는 작업은 model 대신 이 모델로 부른다(ADR-0059).
    """

    provider: str = ""
    model: str = ""
    api_key: str | None = None
    reasoning_effort: str | None = None
    timeout_seconds: float = 60.0
    max_retries: int = 2
    max_output_retries: int = 2
    total_timeout_seconds: float = 120.0
    task_models: dict[str, str] = field(default_factory=dict)


def parse_task_models(raw: str) -> dict[str, str]:
    """`task=모델`을 쉼표로 이은 글자를 읽는다. 형식이 틀리면 서버를 띄울 때 ValueError."""
    models: dict[str, str] = {}
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        task, sep, model = part.partition("=")
        if not sep or not task.strip() or not model.strip():
            raise ValueError(f"LLM_TASK_MODELS 형식이 틀렸습니다(task=모델): {part!r}")
        models[task.strip()] = model.strip()
    return models


def _int(name: str, default: int) -> int:
    value = os.environ.get(name, "").strip()
    return int(value) if value else default


def _float(name: str, default: float) -> float:
    value = os.environ.get(name, "").strip()
    return float(value) if value else default


def load_llm_settings() -> LlmSettings:
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    # 가짜 제공자는 모델을 가리지 않으므로 작업별 모델을 쓰지 않는다
    task_models = (
        parse_task_models(os.environ.get("LLM_TASK_MODELS", DEFAULT_TASK_MODELS.get(provider, "")))
        if provider and provider != "fake"
        else {}
    )
    return LlmSettings(
        provider=provider,
        model=os.environ.get("LLM_MODEL", "").strip(),
        api_key=os.environ.get("LLM_API_KEY", "").strip() or None,
        reasoning_effort=os.environ.get("LLM_REASONING_EFFORT", "").strip().lower() or None,
        timeout_seconds=_float("LLM_TIMEOUT_SECONDS", 60.0),
        max_retries=_int("LLM_MAX_RETRIES", 2),
        max_output_retries=min(_int("LLM_MAX_OUTPUT_RETRIES", 2), 2),
        total_timeout_seconds=_float("LLM_TOTAL_TIMEOUT_SECONDS", 120.0),
        task_models=task_models,
    )
