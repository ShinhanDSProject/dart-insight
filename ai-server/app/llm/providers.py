"""LLM 제공자 연결.

제공자를 바꿀 때는 이 파일에 연결 하나를 더하고 `create_provider`에 이름을 등록한다.

제공자 SDK는 이 파일에서만 가져온다. 다른 코드는 `app.llm.client.LlmClient`만 부른다(AGENTS.md).
실제 제공자는 Anthropic Claude(`anthropic`, ADR-0062)와 OpenAI(`openai`, ADR-0026)다.
테스트·키 없는 개발은 `fake`로 한다.
"""

from __future__ import annotations

import copy
import json
from collections import deque
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import Any, Protocol

import anthropic
import openai

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
    timeout_seconds / total_timeout_seconds: 이 요청에만 쓰는 호출당·전체 제한시간.
        비우면 설정값이다(ADR-0057).
    model: 이 요청에만 쓰는 모델(작업별 모델, ADR-0059). LlmClient가 채우고,
        비우면 제공자의 모델이다.
    """

    task: str
    prompt_version: str
    system: str
    user: str
    output_schema: dict[str, Any] = field(default_factory=dict)
    context: Any = None
    max_output_tokens: int = 2000
    timeout_seconds: float | None = None
    total_timeout_seconds: float | None = None
    model: str | None = None


@dataclass(frozen=True)
class ProviderResponse:
    text: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    # input_tokens 중 프롬프트 캐시에서 읽은 토큰, output_tokens 중 추론 토큰
    # (둘 다 합계에 이미 들어 있음, #633)
    cached_input_tokens: int | None = None
    reasoning_tokens: int | None = None


class ProviderError(Exception):
    """다시 시도해도 나아지지 않는 오류(인증 실패, 잘못된 요청 등)."""


class ProviderTransientError(ProviderError):
    """잠시 뒤 다시 시도하면 나아질 수 있는 오류(시간 초과, 네트워크, 호출 한도, 5xx)."""


class ProviderQuotaError(ProviderError):
    """사용 한도(결제·지출 한도)를 다 써서 다시 시도해도 나아지지 않는 오류.

    운영자가 제공자 쪽 한도를 올려야 풀린다.
    """


class Provider(Protocol):
    name: str
    model: str

    def complete(self, request: LlmRequest, timeout_seconds: float) -> ProviderResponse: ...


Responder = Callable[[LlmRequest], Any]

FAKE_PROVIDER = "fake"
FAKE_DEFAULT_MODEL = "fake-model"


class FakeProvider:
    """테스트·개발용 가짜 응답. 실제 LLM을 부르지 않는다.

    - script: 차례로 돌려줄 응답. dict·list는 JSON 문자열로, str은 그대로,
      Exception은 그 예외를 던진다.
    - responders: script가 비었을 때 task별로 응답을 만드는 함수
      (요청의 context로 결정적인 결과를 만든다).
    둘 다 없으면 빈 JSON 객체를 돌려준다.
    """

    name = FAKE_PROVIDER

    def __init__(
        self,
        script: Iterable[Any] = (),
        responders: dict[str, Responder] | None = None,
        model: str = FAKE_DEFAULT_MODEL,
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


OPENAI_DEFAULT_MODEL = "gpt-6.1-sol"
OPENAI_SCHEMA_NAME = "result"
# Responses API 응답의 상태·항목 유형
STATUS_COMPLETED = "completed"
STATUS_INCOMPLETE = "incomplete"
OUTPUT_MESSAGE = "message"
PART_OUTPUT_TEXT = "output_text"
PART_REFUSAL = "refusal"
INCOMPLETE_MAX_OUTPUT_TOKENS = "max_output_tokens"
INCOMPLETE_CONTENT_FILTER = "content_filter"
# 다시 시도하면 나아질 수 있는 상태 코드(호출 한도, 충돌). 5xx는 따로 본다
TRANSIENT_STATUS_CODES = frozenset({408, 409, 429})
# 429 중 '사용 한도를 다 씀'(결제·프로젝트 지출 한도)은 기다려도 풀리지 않아 다시 시도하지 않는다
QUOTA_ERROR_CODE = "insufficient_quota"


class OpenAIProvider:
    """OpenAI Responses API 연결(ADR-0026).

    - 재시도는 `LlmClient`가 맡으므로 SDK 재시도는 끈다(`max_retries=0`).
    - `output_schema`가 있으면 엄격한 구조화 출력(`text.format` json_schema, strict)으로 받는다.
      엄격 모드 제약은 `strict_schema`로 맞춘다(부른 쪽 스키마는 그대로 둔다).
    - 키가 없으면 만들 때가 아니라 부를 때 `ProviderError`로 실패한다.
    """

    name = "openai"

    def __init__(
        self,
        api_key: str | None,
        model: str = OPENAI_DEFAULT_MODEL,
        reasoning_effort: str | None = None,
        client: Any = None,
    ) -> None:
        self.model = model
        self._api_key = api_key
        self._reasoning_effort = reasoning_effort
        self._client = client

    def _openai(self) -> Any:
        if self._client is None:
            if not self._api_key:
                raise ProviderError("OpenAI 인증키가 없습니다(LLM_API_KEY).")
            self._client = openai.OpenAI(api_key=self._api_key, max_retries=0)
        return self._client

    def complete(self, request: LlmRequest, timeout_seconds: float) -> ProviderResponse:
        model = request.model or self.model
        params: dict[str, Any] = {
            "model": model,
            "instructions": request.system,
            "input": [{"role": "user", "content": request.user}],
            "max_output_tokens": request.max_output_tokens,
            "store": False,
        }
        if request.output_schema:
            params["text"] = {
                "format": {
                    "type": "json_schema",
                    "name": OPENAI_SCHEMA_NAME,
                    "schema": strict_schema(request.output_schema),
                    "strict": True,
                }
            }
        if self._reasoning_effort:
            params["reasoning"] = {"effort": self._reasoning_effort}
        client = self._openai()
        try:
            response = client.with_options(timeout=timeout_seconds).responses.create(**params)
        except openai.APIConnectionError as e:  # 시간 초과(APITimeoutError) 포함
            raise ProviderTransientError(f"OpenAI 연결 실패: {type(e).__name__}") from e
        except openai.APIStatusError as e:
            message = f"OpenAI 오류 {e.status_code}: {type(e).__name__}"
            if e.status_code == 429 and _error_type(e) == QUOTA_ERROR_CODE:
                raise ProviderQuotaError(f"{message} ({QUOTA_ERROR_CODE}: 사용 한도 초과)") from e
            if e.status_code >= 500 or e.status_code in TRANSIENT_STATUS_CODES:
                raise ProviderTransientError(message) from e
            raise ProviderError(message) from e
        except openai.OpenAIError as e:
            raise ProviderError(f"OpenAI 호출 실패: {type(e).__name__}") from e
        return _openai_response(response, model)


def _error_type(error: Any) -> str | None:
    """OpenAI 오류 본문의 error.type(없으면 error.code). 본문이 없거나 모양이 다르면 None."""
    body = error.body if isinstance(error.body, dict) else None
    detail = body.get("error", body) if body is not None else None
    if not isinstance(detail, dict):
        return None
    return detail.get("type") or detail.get("code")


def _openai_response(response: Any, fallback_model: str) -> ProviderResponse:
    if response.status == STATUS_INCOMPLETE:
        details = response.incomplete_details
        reason = details.reason if details is not None else None
        if reason == INCOMPLETE_MAX_OUTPUT_TOKENS:
            raise ProviderError("OpenAI 응답이 출력 토큰 한도(max_output_tokens)에서 잘렸습니다.")
        if reason == INCOMPLETE_CONTENT_FILTER:
            raise ProviderError("OpenAI 응답이 콘텐츠 필터로 중단됐습니다.")
        raise ProviderError(f"OpenAI 응답이 끝나지 않았습니다(사유: {reason}).")
    if response.status not in (None, STATUS_COMPLETED):
        raise ProviderError(f"OpenAI 응답 상태가 완료가 아닙니다({response.status}).")
    texts: list[str] = []
    for item in response.output or []:
        if getattr(item, "type", None) != OUTPUT_MESSAGE:
            continue
        for part in item.content or []:
            if part.type == PART_REFUSAL:
                raise ProviderError("OpenAI 모델이 답을 거절했습니다(refusal).")
            if part.type == PART_OUTPUT_TEXT and part.text is not None:
                texts.append(part.text)
    # 출력 문장이 없으면 빈 문자열을 돌려주고, LlmClient가 JSON 검증 실패로 다시 생성한다
    usage = response.usage
    return ProviderResponse(
        text="".join(texts),
        model=response.model or fallback_model,
        input_tokens=usage.input_tokens if usage is not None else None,
        output_tokens=usage.output_tokens if usage is not None else None,
        cached_input_tokens=_detail(usage, "input_tokens_details", "cached_tokens"),
        reasoning_tokens=_detail(usage, "output_tokens_details", "reasoning_tokens"),
    )


def _detail(usage: Any, details: str, field: str) -> int | None:
    """usage의 세부 토큰 수. 제공자가 알려 주지 않으면 None(0과 구분한다)."""
    value = getattr(getattr(usage, details, None), field, None) if usage is not None else None
    return value if isinstance(value, int) else None


ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5-5"
# 거절했을 때 서버가 다른 모델로 이어 처리하는 대체(ADR-0062). Claude API에서 이 모델들만 지원한다
ANTHROPIC_FALLBACK_MODELS = frozenset({"claude-sonnet-5-5"})
ANTHROPIC_FALLBACK_BETA = "server-side-fallback-2026-07-01"
ANTHROPIC_FALLBACK_DEFAULT = "default"
# Messages API 응답의 끝난 이유·내용 유형
STOP_MAX_TOKENS = "max_tokens"
STOP_REFUSAL = "refusal"
BLOCK_TEXT = "text"
# 결제·사용 한도를 다 쓴 오류(다시 시도하지 않는다)
ANTHROPIC_BILLING_STATUS = 402
ANTHROPIC_BILLING_TYPE = "billing_error"


class AnthropicProvider:
    """Anthropic Claude Messages API 연결(ADR-0062).

    - 재시도는 `LlmClient`가 맡으므로 SDK 재시도는 끈다(`max_retries=0`).
    - `output_schema`가 있으면 구조화 출력(`output_config.format` json_schema)으로 받는다.
      스키마 사본은 `claude_schema`로 맞춘다(`strict_schema` + 지원하지 않는 제약을 설명 글로).
      그런 제약(`maxItems` 등)은 기능 모듈의 검증 함수가 검사한다.
    - 생각(adaptive thinking)은 모델 기본으로 둔다.
      추론 강도가 있으면 `output_config.effort`로 보낸다.
    - 고정된 앞부분(시스템 프롬프트)을 프롬프트 캐시에 둔다(`cache_control`, #633 순서 그대로).
    - 키가 없으면 만들 때가 아니라 부를 때 `ProviderError`로 실패한다.
    """

    name = "anthropic"

    def __init__(
        self,
        api_key: str | None,
        model: str = ANTHROPIC_DEFAULT_MODEL,
        reasoning_effort: str | None = None,
        client: Any = None,
    ) -> None:
        self.model = model
        self._api_key = api_key
        self._reasoning_effort = reasoning_effort
        self._client = client

    def _anthropic(self) -> Any:
        if self._client is None:
            if not self._api_key:
                raise ProviderError("Anthropic 인증키가 없습니다(LLM_API_KEY).")
            self._client = anthropic.Anthropic(api_key=self._api_key, max_retries=0)
        return self._client

    def complete(self, request: LlmRequest, timeout_seconds: float) -> ProviderResponse:
        model = request.model or self.model
        params: dict[str, Any] = {
            "model": model,
            "system": request.system,
            "messages": [{"role": "user", "content": request.user}],
            "max_tokens": request.max_output_tokens,
            "cache_control": {"type": "ephemeral"},
        }
        output_config: dict[str, Any] = {}
        if request.output_schema:
            output_config["format"] = {
                "type": "json_schema",
                "schema": claude_schema(request.output_schema),
            }
        if self._reasoning_effort:
            output_config["effort"] = self._reasoning_effort
        if output_config:
            params["output_config"] = output_config
        if model in ANTHROPIC_FALLBACK_MODELS:
            params["betas"] = [ANTHROPIC_FALLBACK_BETA]
            params["fallbacks"] = ANTHROPIC_FALLBACK_DEFAULT
        client = self._anthropic()
        try:
            response = client.with_options(timeout=timeout_seconds).beta.messages.create(**params)
        except anthropic.APIConnectionError as e:  # 시간 초과(APITimeoutError) 포함
            raise ProviderTransientError(f"Anthropic 연결 실패: {type(e).__name__}") from e
        except anthropic.APIStatusError as e:
            message = f"Anthropic 오류 {e.status_code}: {type(e).__name__}"
            if _is_anthropic_quota(e):
                raise ProviderQuotaError(f"{message} (사용 한도 초과)") from e
            if e.status_code >= 500 or e.status_code in TRANSIENT_STATUS_CODES:
                raise ProviderTransientError(message) from e
            raise ProviderError(message) from e
        except anthropic.AnthropicError as e:
            raise ProviderError(f"Anthropic 호출 실패: {type(e).__name__}") from e
        return _anthropic_response(response, model)


def _is_anthropic_quota(error: Any) -> bool:
    """결제 문제(402)나 조직 지출 한도 초과(429 enforced_spend_limit_reached)인지."""
    return (
        isinstance(error, anthropic.EnforcedSpendLimitReachedError)
        or error.status_code == ANTHROPIC_BILLING_STATUS
        or getattr(error, "type", None) == ANTHROPIC_BILLING_TYPE
    )


def _anthropic_response(response: Any, fallback_model: str) -> ProviderResponse:
    if response.stop_reason == STOP_REFUSAL:
        raise ProviderError("Anthropic 모델이 답을 거절했습니다(refusal).")
    if response.stop_reason == STOP_MAX_TOKENS:
        raise ProviderError("Anthropic 응답이 출력 토큰 한도(max_tokens)에서 잘렸습니다.")
    # 생각(thinking)·대체(fallback) 블록은 건너뛰고 답 글만 모은다.
    # 글이 없으면 빈 문자열을 돌려주고, LlmClient가 JSON 검증 실패로 다시 생성한다
    texts = [
        block.text
        for block in response.content or []
        if getattr(block, "type", None) == BLOCK_TEXT and block.text is not None
    ]
    usage = response.usage
    cache_read = _int_or_none(getattr(usage, "cache_read_input_tokens", None))
    cache_write = _int_or_none(getattr(usage, "cache_creation_input_tokens", None))
    base_input = _int_or_none(getattr(usage, "input_tokens", None))
    # Claude의 input_tokens는 캐시 토큰을 뺀 수라, 지금 기록 방식(캐시 포함 합계)에 맞춰 더한다
    input_tokens = (
        base_input + (cache_read or 0) + (cache_write or 0) if base_input is not None else None
    )
    return ProviderResponse(
        text="".join(texts),
        model=response.model or fallback_model,
        input_tokens=input_tokens,
        output_tokens=_int_or_none(getattr(usage, "output_tokens", None)),
        cached_input_tokens=cache_read,
        # 추론 토큰 수는 따로 알려 주지 않는다(0과 구분해 None)
        reasoning_tokens=None,
    )


def _int_or_none(value: Any) -> int | None:
    return value if isinstance(value, int) else None


# Claude 구조화 출력이 받지 않는 JSON Schema 제약(숫자·글자 길이·배열 개수 등)
CLAUDE_UNSUPPORTED_KEYWORDS = (
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "minLength",
    "maxLength",
    "pattern",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
)
# minItems는 0·1만 받는다
CLAUDE_SUPPORTED_MIN_ITEMS = (0, 1)


def claude_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """JSON Schema를 Claude 구조화 출력의 제약에 맞춘 사본(ADR-0062).

    `strict_schema`로 맞춘 뒤, 받지 않는 제약은 빼고 그 내용을 `description`에 적어
    모델이 알 수 있게 한다(SDK `transform_schema`와 같은 방식. SDK 함수는 `["string", "null"]` 같은
    타입 목록을 받지 못해 직접 한다). 뺀 제약은 기능 모듈의 검증 함수가 검사해야 한다.
    """
    return _claude(strict_schema(schema))


def _claude(node: Any) -> Any:
    if isinstance(node, list):
        return [_claude(v) for v in node]
    if not isinstance(node, dict):
        return node
    moved: dict[str, Any] = {}
    for key in CLAUDE_UNSUPPORTED_KEYWORDS:
        if key in node:
            moved[key] = node.pop(key)
    if "minItems" in node and node["minItems"] not in CLAUDE_SUPPORTED_MIN_ITEMS:
        moved["minItems"] = node.pop("minItems")
    for key, value in list(node.items()):
        if key in ("properties", "$defs", "definitions") and isinstance(value, dict):
            node[key] = {k: _claude(v) for k, v in value.items()}
        elif key in ("items", "anyOf", "allOf"):
            node[key] = _claude(value)
    if moved:
        note = "{" + ", ".join(f"{k}: {json.dumps(v)}" for k, v in moved.items()) + "}"
        description = node.get("description")
        node["description"] = f"{description}\n\n{note}" if description else note
    return node


def strict_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """JSON Schema를 OpenAI 엄격 구조화 출력의 제약에 맞춘 사본.

    - 객체는 `additionalProperties: false`를 두고 모든 속성을 `required`에 넣는다.
    - 원래 필수가 아니던 속성은 null을 허용해 '없음'을 null로 받는다.
    - `type` 없이 `enum`만 있으면 값에서 type을 정한다.
    """
    return _strict(copy.deepcopy(schema), nullable=False)


def _strict(node: Any, nullable: bool) -> Any:
    if not isinstance(node, dict):
        return node
    if "enum" in node and "type" not in node:
        node["type"] = _enum_types(node["enum"])
    if nullable:
        _allow_null(node)
    properties = node.get("properties")
    if isinstance(properties, dict):
        required = set(node.get("required", []))
        node["properties"] = {
            key: _strict(value, nullable=key not in required) for key, value in properties.items()
        }
        node["required"] = list(properties)
        node["additionalProperties"] = False
    if "items" in node:
        node["items"] = _strict(node["items"], nullable=False)
    for key in ("anyOf", "$defs", "definitions"):
        if isinstance(node.get(key), list):
            node[key] = [_strict(v, nullable=False) for v in node[key]]
        elif isinstance(node.get(key), dict):
            node[key] = {k: _strict(v, nullable=False) for k, v in node[key].items()}
    return node


def _enum_types(values: list[Any]) -> list[str] | str:
    names: list[str] = []
    for value in values:
        if value is None:
            name = "null"
        elif isinstance(value, bool):
            name = "boolean"
        elif isinstance(value, int):
            name = "integer"
        elif isinstance(value, float):
            name = "number"
        else:
            name = "string"
        if name not in names:
            names.append(name)
    return names[0] if len(names) == 1 else names


def _allow_null(node: dict[str, Any]) -> None:
    if "anyOf" in node:
        if {"type": "null"} not in node["anyOf"]:
            node["anyOf"].append({"type": "null"})
        return
    kind = node.get("type")
    if kind is None:
        return
    kinds = kind if isinstance(kind, list) else [kind]
    if "null" not in kinds:
        node["type"] = [*kinds, "null"]
    if "enum" in node and None not in node["enum"]:
        node["enum"] = [*node["enum"], None]


# 기능 모듈이 가짜 응답 함수를 등록해 두는 곳(예: 요약 기능이 import될 때 `summary` 등록)
FAKE_RESPONDERS: dict[str, Responder] = {}


def create_provider(settings: LlmSettings) -> Provider | None:
    """설정에 맞는 제공자. LLM을 쓰지 않도록 설정했으면 None.

    알 수 없는 제공자 이름이면 ValueError.
    실제 제공자는 키가 없으면 None을 돌려주지 않고 호출할 때 실패한다.
    """
    if not settings.provider:
        return None
    if settings.provider == FakeProvider.name:
        return FakeProvider(responders=FAKE_RESPONDERS, model=settings.model or FAKE_DEFAULT_MODEL)
    if settings.provider == AnthropicProvider.name:
        return AnthropicProvider(
            api_key=settings.api_key,
            model=settings.model or ANTHROPIC_DEFAULT_MODEL,
            reasoning_effort=settings.reasoning_effort,
        )
    if settings.provider == OpenAIProvider.name:
        return OpenAIProvider(
            api_key=settings.api_key,
            model=settings.model or OPENAI_DEFAULT_MODEL,
            reasoning_effort=settings.reasoning_effort,
        )
    raise ValueError(
        f"지원하지 않는 LLM_PROVIDER입니다: {settings.provider}. "
        "지원: fake, anthropic, openai(app/llm/providers.py)."
    )
