"""LLM 호출 모듈(0.7). AI 서버의 모든 LLM 호출은 `LlmClient.generate`를 거친다.

- 호출마다 제공자·모델·프롬프트 버전·호출 시각·토큰 수·추적 ID·걸린 시간·결과를 기록한다
  (로그와 `CallRecord`).
- 네트워크 오류·시간 초과처럼 일시적인 오류는 `max_retries`번까지 다시 시도한다.
- 결과는 JSON으로 받고, 형식·검증에 실패하면 문제를 알려 주며
  `max_output_retries`번까지 다시 생성한다.
  그래도 실패하면 `LlmOutputInvalid`로 끝낸다. 실패를 성공으로 처리하지 않는다.
- 제공자가 없거나(키 없음 포함) 호출이 끝내 실패하면 `LlmUnavailable`.
  부른 쪽이 분석을 실패로 끝낸다.
- 사용자 정보는 프롬프트에 넣지 않는다. 공시 원문은 `app.llm.prompting.disclosure`로 감싼다.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import LlmSettings
from app.core.context import current_trace_id
from app.llm.providers import (
    LlmRequest,
    Provider,
    ProviderError,
    ProviderTransientError,
    create_provider,
)

logger = logging.getLogger("app.llm")
KST = timezone(timedelta(hours=9))


class LlmError(Exception):
    def __init__(self, message: str, calls: list[CallRecord] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.calls = calls or []


class LlmUnavailable(LlmError):
    """LLM을 부를 수 없음: 제공자 미설정, 인증 실패, 다시 시도해도 실패."""


class LlmOutputInvalid(LlmError):
    """다시 생성해도 결과가 형식·검증을 통과하지 못함."""

    def __init__(self, message: str, problems: list[str], calls: list[CallRecord]) -> None:
        super().__init__(message, calls)
        self.problems = problems


@dataclass(frozen=True)
class CallRecord:
    """LLM 호출 한 번의 기록. backend가 받아 분석과 함께 저장한다(비용 집계·감사용)."""

    task: str
    provider: str
    model: str
    prompt_version: str
    called_at: str
    trace_id: str
    input_tokens: int | None
    output_tokens: int | None
    latency_ms: int
    attempt: int
    outcome: str  # OK, INVALID_OUTPUT, TRANSIENT_ERROR, ERROR
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "task": self.task,
            "provider": self.provider,
            "model": self.model,
            "promptVersion": self.prompt_version,
            "calledAt": self.called_at,
            "traceId": self.trace_id,
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "latencyMs": self.latency_ms,
            "attempt": self.attempt,
            "outcome": self.outcome,
            "error": self.error,
        }


@dataclass
class LlmResult[T]:
    value: T
    model: str
    prompt_version: str
    generated_at: str
    calls: list[CallRecord] = field(default_factory=list)


class OutputProblem(ValueError):
    """결과가 형식·검증을 통과하지 못함. problems는 다시 생성할 때 LLM에 알려 줄 문장."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("; ".join(problems))
        self.problems = problems


class LlmClient:
    def __init__(
        self,
        provider: Provider | None,
        settings: LlmSettings,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], datetime] = lambda: datetime.now(KST),
    ) -> None:
        self.provider = provider
        self.settings = settings
        self._sleep = sleep
        self._clock = clock

    @classmethod
    def from_settings(cls, settings: LlmSettings) -> LlmClient:
        return cls(create_provider(settings), settings)

    @property
    def available(self) -> bool:
        return self.provider is not None

    def generate[T](self, request: LlmRequest, validate: Callable[[Any], T]) -> LlmResult[T]:
        """JSON 결과를 받아 validate로 검사해 값으로 바꾼다.

        validate는 문제가 있으면 OutputProblem을 던진다. 그러면 문제를 알려 주며 다시 생성한다.
        """
        if self.provider is None:
            raise LlmUnavailable("LLM 제공자가 설정되지 않았어요(LLM_PROVIDER).")
        calls: list[CallRecord] = []
        problems: list[str] = []
        current = request
        for round_no in range(self.settings.max_output_retries + 1):
            if problems:
                current = replace(request, user=request.user + _feedback(problems))
            text, record = self._call_with_retry(current, calls)
            try:
                value = validate(_parse_json(text))
            except OutputProblem as e:
                problems = e.problems
                calls[-1] = replace(record, outcome="INVALID_OUTPUT", error=str(e)[:500])
                _log(calls[-1])
                logger.info("LLM 결과 검증 실패(%d/%d): %s", round_no + 1,
                            self.settings.max_output_retries + 1, e)
                continue
            _log(record)
            return LlmResult(value, record.model, request.prompt_version, record.called_at, calls)
        raise LlmOutputInvalid("다시 생성해도 결과가 검증을 통과하지 못했어요.", problems, calls)

    def _call_with_retry(
        self, request: LlmRequest, calls: list[CallRecord]
    ) -> tuple[str, CallRecord]:
        assert self.provider is not None
        attempt = 0
        while True:
            attempt += 1
            called_at = self._clock().strftime("%Y-%m-%dT%H:%M:%S")
            started = time.monotonic()
            try:
                response = self.provider.complete(request, self.settings.timeout_seconds)
            except ProviderTransientError as e:
                record = self._record(request, called_at, started, attempt, "TRANSIENT_ERROR",
                                      error=_short(e))
                calls.append(record)
                _log(record)
                if attempt > self.settings.max_retries:
                    raise LlmUnavailable("LLM 호출이 계속 실패했어요. 잠시 뒤 다시 요청해 주세요.",
                                         calls) from e
                self._sleep(min(2.0 * attempt, 10.0))
                continue
            except ProviderError as e:
                record = self._record(request, called_at, started, attempt, "ERROR",
                                      error=_short(e))
                calls.append(record)
                _log(record)
                raise LlmUnavailable("LLM을 부르지 못했어요(설정·인증 확인 필요).", calls) from e
            record = self._record(request, called_at, started, attempt, "OK",
                                  model=response.model, input_tokens=response.input_tokens,
                                  output_tokens=response.output_tokens)
            calls.append(record)
            return response.text, record

    def _record(
        self,
        request: LlmRequest,
        called_at: str,
        started: float,
        attempt: int,
        outcome: str,
        model: str | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        error: str | None = None,
    ) -> CallRecord:
        assert self.provider is not None
        return CallRecord(
            task=request.task,
            provider=self.provider.name,
            model=model or self.provider.model,
            prompt_version=request.prompt_version,
            called_at=called_at,
            trace_id=current_trace_id(),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=int((time.monotonic() - started) * 1000),
            attempt=attempt,
            outcome=outcome,
            error=error,
        )


def _parse_json(text: str) -> Any:
    stripped = text.strip()
    # 일부 모델이 코드 블록으로 감싸 돌려주는 경우를 벗긴다
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:]
    try:
        return json.loads(stripped)
    except json.JSONDecodeError as e:
        problem = f"JSON으로 읽을 수 없습니다({e.msg}). JSON 객체 하나만 답하세요."
        raise OutputProblem([problem]) from e


def _feedback(problems: list[str]) -> str:
    lines = "\n".join(f"- {p}" for p in problems[:20])
    head = "이전 응답에 아래 문제가 있었습니다. 고쳐서 JSON 객체 하나만 다시 답하세요."
    return f"\n\n{head}\n{lines}"


def _short(e: Exception) -> str:
    return f"{type(e).__name__}: {e}"[:300]


def _log(record: CallRecord) -> None:
    logger.info(
        "LLM 호출 task=%s provider=%s model=%s prompt=%s attempt=%d tokens=%s/%s %dms %s%s",
        record.task, record.provider, record.model, record.prompt_version, record.attempt,
        record.input_tokens, record.output_tokens, record.latency_ms, record.outcome,
        f" ({record.error})" if record.error else "",
    )
