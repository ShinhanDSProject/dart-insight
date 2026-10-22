"""LLM 제공자 연결.

제공자를 바꿀 때는 이 파일에 연결 하나를 더하고 `create_provider`에 이름을 등록한다.

제공자 SDK는 이 파일에서만 가져온다. 다른 코드는 `app.llm.client.LlmClient`만 부른다(AGENTS.md).
LLM 제공자·모델은 아직 정하지 않았다(결정 로그 'LLM 제공자·모델 선택').
그때까지는 `fake`로 개발·테스트한다.
"""

from __future__ import annotations

import json
from collections import deque
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.config import LlmSettings


@dataclass(frozen=True)
class LlmRequest:
    """LLM 한 번 호출에 넣는 값.

    task: 기능 이름(예: `summary`). 호출 기록과 가짜 응답 선택에 쓴다.
    prompt_version: 프롬프트 버전. 프롬프트를 고치면 올린다.
    system / user: 프롬프트. 공시 원문은 `app.llm.prompting.disclosure`로 감싸 넣는다.
    output_schema: 받을 JSON의 모양(JSON Schema). 구조화 출력을 지원하는 제공자에 넘긴다.
    context: 프롬프트를 만든 구조화 자료. 실제 제공자는 쓰지 않고,
        가짜 응답이 그럴듯한 결과를 만들 때만 쓴다.
    """

    task: str
    prompt_version: str
    system: str
    user: str
    output_schema: dict[str, Any] = field(default_factory=dict)
    context: Any = None
    max_output_tokens: int = 2000


@dataclass(frozen=True)
class ProviderResponse:
    text: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None


class ProviderError(Exception):
    """다시 시도해도 나아지지 않는 오류(인증 실패, 잘못된 요청 등)."""


class ProviderTransientError(ProviderError):
    """잠시 뒤 다시 시도하면 나아질 수 있는 오류(시간 초과, 네트워크, 호출 한도, 5xx)."""


class Provider(Protocol):
    name: str
    model: str

    def complete(self, request: LlmRequest, timeout_seconds: float) -> ProviderResponse: ...


Responder = Callable[[LlmRequest], Any]


class FakeProvider:
    """테스트·개발용 가짜 응답. 실제 LLM을 부르지 않는다.

    - script: 차례로 돌려줄 응답. dict·list는 JSON 문자열로, str은 그대로,
      Exception은 그 예외를 던진다.
    - responders: script가 비었을 때 task별로 응답을 만드는 함수
      (요청의 context로 결정적인 결과를 만든다).
    둘 다 없으면 빈 JSON 객체를 돌려준다.
    """

    name = "fake"

    def __init__(
        self,
        script: Iterable[Any] = (),
        responders: dict[str, Responder] | None = None,
        model: str = "fake-model",
    ) -> None:
        self.model = model
        self._script: deque[Any] = deque(script)
        self._responders = dict(responders or {})
        self.requests: list[LlmRequest] = []

    def register(self, task: str, responder: Responder) -> None:
        self._responders[task] = responder

    def complete(self, request: LlmRequest, timeout_seconds: float) -> ProviderResponse:
        self.requests.append(request)
        if self._script:
            value = self._script.popleft()
        elif request.task in self._responders:
            value = self._responders[request.task](request)
        else:
            value = {}
        if isinstance(value, Exception):
            raise value
        text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        return ProviderResponse(
            text=text,
            model=self.model,
            input_tokens=len(request.system) + len(request.user),
            output_tokens=len(text),
        )


# 기능 모듈이 가짜 응답 함수를 등록해 두는 곳(예: 요약 기능이 import될 때 `summary` 등록)
FAKE_RESPONDERS: dict[str, Responder] = {}


def create_provider(settings: LlmSettings) -> Provider | None:
    """설정에 맞는 제공자. LLM을 쓰지 않도록 설정했으면 None.

    알 수 없는 제공자 이름이면 ValueError.
    실제 제공자는 키가 없으면 None을 돌려주지 않고 호출할 때 실패한다.
    """
    if not settings.provider:
        return None
    if settings.provider == "fake":
        return FakeProvider(responders=FAKE_RESPONDERS, model=settings.model or "fake-model")
    raise ValueError(
        f"지원하지 않는 LLM_PROVIDER입니다: {settings.provider}. "
        "제공자를 정하면 app/llm/providers.py에 연결을 더합니다."
    )
