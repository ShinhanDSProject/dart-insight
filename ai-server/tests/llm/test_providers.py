from dataclasses import replace
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx
import httpx2
import openai
import pytest

from app.answer.prompt import OUTPUT_SCHEMA as ANSWER_SCHEMA
from app.core.config import LlmSettings, load_llm_settings
from app.llm import LlmRequest, ProviderError, ProviderQuotaError, ProviderTransientError
from app.llm.providers import (
    ANTHROPIC_DEFAULT_MODEL,
    OPENAI_DEFAULT_MODEL,
    AnthropicProvider,
    OpenAIProvider,
    create_provider,
    strict_schema,
)
from app.summary.prompt import OUTPUT_SCHEMA as SUMMARY_SCHEMA

SCHEMA = {
    "type": "object",
    "required": ["answer"],
    "properties": {"answer": {"type": "string"}, "note": {"type": "string"}},
}
REQUEST = LlmRequest(
    task="test",
    prompt_version="test-v1",
    system="시스템",
    user="사용자",
    output_schema=SCHEMA,
    max_output_tokens=800,
)
FAKE_KEY = "test-key-not-real"
USAGE = SimpleNamespace(input_tokens=120, output_tokens=45)


def text_part(text: str) -> SimpleNamespace:
    return SimpleNamespace(type="output_text", text=text)


def response(
    *parts: SimpleNamespace,
    status: str = "completed",
    reason: str | None = None,
    usage: Any = USAGE,
) -> SimpleNamespace:
    return SimpleNamespace(
        status=status,
        incomplete_details=SimpleNamespace(reason=reason) if reason else None,
        output=[
            SimpleNamespace(type="reasoning", content=None),
            SimpleNamespace(type="message", content=list(parts)),
        ],
        model="gpt-6.1-sol",
        usage=usage,
    )


class FakeResponses:
    def __init__(self, result: Any) -> None:
        self.result = result
        self.calls: list[dict[str, Any]] = []

    def create(self, **params: Any) -> Any:
        self.calls.append(params)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class FakeOpenAI:
    def __init__(self, result: Any) -> None:
        self.responses = FakeResponses(result)
        self.timeouts: list[float] = []

    def with_options(self, timeout: float) -> "FakeOpenAI":
        self.timeouts.append(timeout)
        return self


def provider(result: Any, reasoning_effort: str | None = None) -> tuple[OpenAIProvider, FakeOpenAI]:
    fake = FakeOpenAI(result)
    return OpenAIProvider(FAKE_KEY, reasoning_effort=reasoning_effort, client=fake), fake


def status_error(cls: type[openai.APIStatusError], code: int) -> openai.APIStatusError:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    return cls("오류", response=httpx.Response(code, request=request), body=None)


def test_complete_sends_responses_request_with_strict_schema_and_timeout() -> None:
    p, fake = provider(response(text_part('{"answer": "네"}')))

    p.complete(REQUEST, 30.0)

    params = fake.responses.calls[0]
    assert params["model"] == OPENAI_DEFAULT_MODEL
    assert params["instructions"] == "시스템"
    assert params["input"] == [{"role": "user", "content": "사용자"}]
    assert params["max_output_tokens"] == 800
    assert params["store"] is False
    assert "reasoning" not in params
    fmt = params["text"]["format"]
    assert fmt["type"] == "json_schema"
    assert fmt["strict"] is True
    assert fmt["schema"]["additionalProperties"] is False
    assert fmt["schema"]["required"] == ["answer", "note"]
    assert fake.timeouts == [30.0]


def test_complete_uses_request_model_over_provider_model() -> None:
    p, fake = provider(response(text_part("{}")))

    result = p.complete(replace(REQUEST, model="gpt-6-luna"), 30.0)

    # 작업별 모델(ADR-0059): 요청의 모델이 있으면 그 모델로 부른다
    assert fake.responses.calls[0]["model"] == "gpt-6-luna"
    assert result.model


def test_complete_omits_text_format_without_schema() -> None:
    p, fake = provider(response(text_part("{}")))

    p.complete(LlmRequest(task="t", prompt_version="v", system="s", user="u"), 10.0)

    assert "text" not in fake.responses.calls[0]


def test_complete_sends_reasoning_effort_when_set() -> None:
    p, fake = provider(response(text_part("{}")), reasoning_effort="high")

    p.complete(REQUEST, 10.0)

    assert fake.responses.calls[0]["reasoning"] == {"effort": "high"}


def test_complete_returns_joined_text_model_and_usage() -> None:
    p, _ = provider(response(text_part('{"answer": '), text_part('"네"}')))

    result = p.complete(REQUEST, 10.0)

    assert result.text == '{"answer": "네"}'
    assert result.model == "gpt-6.1-sol"
    assert (result.input_tokens, result.output_tokens) == (120, 45)


def test_complete_keeps_tokens_none_without_usage() -> None:
    p, _ = provider(response(text_part("{}"), usage=None))

    result = p.complete(REQUEST, 10.0)

    assert (result.input_tokens, result.output_tokens) == (None, None)
    assert (result.cached_input_tokens, result.reasoning_tokens) == (None, None)


def test_complete_reads_cached_input_and_reasoning_tokens() -> None:
    usage = SimpleNamespace(
        input_tokens=10000,
        output_tokens=300,
        input_tokens_details=SimpleNamespace(cached_tokens=8960),
        output_tokens_details=SimpleNamespace(reasoning_tokens=256),
    )
    p, _ = provider(response(text_part("{}"), usage=usage))

    result = p.complete(REQUEST, 10.0)

    # 세부 토큰은 합계에 이미 들어 있어 따로 더하지 않는다(#633)
    assert (result.input_tokens, result.output_tokens) == (10000, 300)
    assert (result.cached_input_tokens, result.reasoning_tokens) == (8960, 256)


def test_complete_keeps_detail_tokens_none_when_provider_omits_them() -> None:
    p, _ = provider(response(text_part("{}")))

    result = p.complete(REQUEST, 10.0)

    # 세부 값을 알려 주지 않으면 0이 아니라 None이다
    assert (result.cached_input_tokens, result.reasoning_tokens) == (None, None)


def test_complete_raises_provider_error_on_refusal() -> None:
    p, _ = provider(response(SimpleNamespace(type="refusal", refusal="도울 수 없어요")))

    with pytest.raises(ProviderError, match="거절") as caught:
        p.complete(REQUEST, 10.0)
    assert not isinstance(caught.value, ProviderTransientError)


@pytest.mark.parametrize(
    ("reason", "message"),
    [("max_output_tokens", "토큰 한도"), ("content_filter", "콘텐츠 필터"), (None, "끝나지")],
)
def test_complete_raises_provider_error_on_incomplete(reason: str | None, message: str) -> None:
    p, _ = provider(response(text_part('{"ans'), status="incomplete", reason=reason))

    with pytest.raises(ProviderError, match=message) as caught:
        p.complete(REQUEST, 10.0)
    assert not isinstance(caught.value, ProviderTransientError)


def test_complete_raises_provider_error_on_failed_status() -> None:
    p, _ = provider(response(status="failed"))

    with pytest.raises(ProviderError, match="failed"):
        p.complete(REQUEST, 10.0)


@pytest.mark.parametrize(
    "error",
    [
        openai.APITimeoutError(request=httpx.Request("POST", "https://api.openai.com")),
        openai.APIConnectionError(request=httpx.Request("POST", "https://api.openai.com")),
        status_error(openai.RateLimitError, 429),
        status_error(openai.InternalServerError, 500),
        status_error(openai.InternalServerError, 503),
        status_error(openai.ConflictError, 409),
    ],
)
def test_complete_maps_temporary_errors_to_transient(error: Exception) -> None:
    p, _ = provider(error)

    with pytest.raises(ProviderTransientError):
        p.complete(REQUEST, 10.0)


def test_complete_maps_spent_quota_429_to_quota_error_not_transient() -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    body = {"error": {"type": "insufficient_quota", "code": "project_spend_limit_exceeded"}}
    error = openai.RateLimitError("오류", response=httpx.Response(429, request=request), body=body)
    p, _ = provider(error)

    # 지출 한도를 다 쓴 429는 기다려도 풀리지 않아 다시 시도하지 않는다
    with pytest.raises(ProviderQuotaError, match="insufficient_quota") as caught:
        p.complete(REQUEST, 10.0)
    assert not isinstance(caught.value, ProviderTransientError)


@pytest.mark.parametrize(
    "error",
    [
        status_error(openai.AuthenticationError, 401),
        status_error(openai.PermissionDeniedError, 403),
        status_error(openai.BadRequestError, 400),
        status_error(openai.NotFoundError, 404),
        status_error(openai.UnprocessableEntityError, 422),
    ],
)
def test_complete_maps_permanent_errors_to_provider_error(error: Exception) -> None:
    p, _ = provider(error)

    with pytest.raises(ProviderError) as caught:
        p.complete(REQUEST, 10.0)
    assert not isinstance(caught.value, ProviderTransientError)


def test_complete_fails_at_call_time_without_api_key() -> None:
    p = create_provider(LlmSettings(provider="openai"))

    assert isinstance(p, OpenAIProvider)
    with pytest.raises(ProviderError, match="LLM_API_KEY") as caught:
        p.complete(REQUEST, 10.0)
    assert not isinstance(caught.value, ProviderTransientError)


def test_create_provider_uses_model_and_reasoning_effort_from_settings() -> None:
    settings = LlmSettings(
        provider="openai", model="gpt-6-luna", api_key=FAKE_KEY, reasoning_effort="low"
    )

    p = create_provider(settings)

    assert isinstance(p, OpenAIProvider)
    assert p.name == "openai"
    assert p.model == "gpt-6-luna"


def test_create_provider_builds_sdk_client_without_sdk_retries() -> None:
    p = create_provider(LlmSettings(provider="openai", api_key=FAKE_KEY))

    assert isinstance(p, OpenAIProvider)
    assert p.model == OPENAI_DEFAULT_MODEL
    client = p._openai()
    assert isinstance(client, openai.OpenAI)
    assert client.max_retries == 0


def test_load_llm_settings_reads_reasoning_effort(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_REASONING_EFFORT", " High ")

    assert load_llm_settings().reasoning_effort == "high"


def test_load_llm_settings_leaves_reasoning_effort_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLM_REASONING_EFFORT", raising=False)

    assert load_llm_settings().reasoning_effort is None


def test_strict_schema_requires_all_properties_and_makes_optional_nullable() -> None:
    result = strict_schema(SCHEMA)

    assert result["required"] == ["answer", "note"]
    assert result["additionalProperties"] is False
    assert result["properties"]["answer"] == {"type": "string"}
    assert result["properties"]["note"] == {"type": ["string", "null"]}
    assert "additionalProperties" not in SCHEMA  # 부른 쪽 스키마는 그대로


def test_strict_schema_adapts_nested_objects_and_enum_without_type() -> None:
    result = strict_schema(SUMMARY_SCHEMA)

    item = result["properties"]["items"]["items"]
    assert item["additionalProperties"] is False
    assert item["required"] == list(item["properties"])
    assert item["properties"]["grade"]["type"] == ["string", "null"]
    assert None in item["properties"]["grade"]["enum"]
    assert item["properties"]["evidenceIds"] == {"type": "array", "items": {"type": "string"}}
    assert item["properties"]["sentence"] == {"type": ["string", "null"]}


def test_strict_schema_keeps_required_enum_without_null() -> None:
    result = strict_schema(ANSWER_SCHEMA)

    status = result["properties"]["status"]
    assert status["type"] == "string"
    assert None not in status["enum"]
    assert result["required"] == [
        "status",
        "answer",
        "evidenceIds",
        "factRefs",
        "reasonNotStated",
    ]


# ── Anthropic Claude(ADR-0062) ─────────────────────────────

CLAUDE_USAGE = SimpleNamespace(
    input_tokens=120,
    output_tokens=45,
    cache_read_input_tokens=None,
    cache_creation_input_tokens=None,
)


def claude_response(
    *texts: str,
    stop_reason: str = "end_turn",
    usage: Any = CLAUDE_USAGE,
    model: str = ANTHROPIC_DEFAULT_MODEL,
) -> SimpleNamespace:
    return SimpleNamespace(
        content=[
            SimpleNamespace(type="thinking", thinking=""),
            *(SimpleNamespace(type="text", text=t) for t in texts),
        ],
        stop_reason=stop_reason,
        model=model,
        usage=usage,
    )


class FakeClaudeMessages:
    def __init__(self, result: Any) -> None:
        self.result = result
        self.calls: list[dict[str, Any]] = []

    def create(self, **params: Any) -> Any:
        self.calls.append(params)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class FakeAnthropic:
    def __init__(self, result: Any) -> None:
        self.messages = FakeClaudeMessages(result)
        self.beta = SimpleNamespace(messages=self.messages)
        self.timeouts: list[float] = []

    def with_options(self, timeout: float) -> "FakeAnthropic":
        self.timeouts.append(timeout)
        return self


def claude(
    result: Any, reasoning_effort: str | None = None
) -> tuple[AnthropicProvider, FakeAnthropic]:
    fake = FakeAnthropic(result)
    return AnthropicProvider(FAKE_KEY, reasoning_effort=reasoning_effort, client=fake), fake


def claude_status_error(code: int, body: Any = None, cls: Any = None) -> anthropic.APIStatusError:
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    error_cls = cls or anthropic.APIStatusError
    return error_cls("오류", response=httpx2.Response(code, request=request), body=body)


def test_claude_sends_messages_request_with_schema_fallback_and_timeout() -> None:
    p, fake = claude(claude_response('{"answer": "네"}'))

    # 거절 대체는 claude-sonnet-5-5만 지원한다(기본 모델 claude-haiku-5-5에는 붙지 않음, ADR-0063)
    p.complete(replace(REQUEST, model="claude-sonnet-5-5"), 30.0)

    params = fake.messages.calls[0]
    assert params["model"] == "claude-sonnet-5-5"
    assert params["system"][0]["text"] == "시스템"
    assert params["messages"][0]["role"] == "user"
    assert params["max_tokens"] == 800
    assert "thinking" not in params  # 생각은 모델 기본(adaptive)
    fmt = params["output_config"]["format"]
    assert fmt["type"] == "json_schema"
    assert fmt["schema"]["additionalProperties"] is False
    assert fmt["schema"]["required"] == ["answer"]  # 선택 속성은 그대로(claude_schema)
    assert "effort" not in params["output_config"]
    # Sonnet 5.5는 거절했을 때 서버가 다른 모델로 이어 처리한다
    assert params["fallbacks"] == "default"
    assert params["betas"] == ["server-side-fallback-2026-07-01"]
    assert fake.timeouts == [30.0]


def test_claude_omits_fallback_for_models_without_it() -> None:
    p, fake = claude(claude_response("{}"))

    p.complete(replace(REQUEST, model="claude-haiku-5-5"), 10.0)

    params = fake.messages.calls[0]
    assert params["model"] == "claude-haiku-5-5"
    assert "fallbacks" not in params
    assert "betas" not in params


def test_claude_omits_output_config_without_schema_or_effort() -> None:
    p, fake = claude(claude_response("{}"))

    p.complete(LlmRequest(task="t", prompt_version="v", system="s", user="u"), 10.0)

    assert "output_config" not in fake.messages.calls[0]


def test_claude_sends_reasoning_effort_as_output_config_effort() -> None:
    p, fake = claude(claude_response("{}"), reasoning_effort="low")

    p.complete(REQUEST, 10.0)

    assert fake.messages.calls[0]["output_config"]["effort"] == "low"


def test_claude_moves_unsupported_array_limits_out_of_schema() -> None:
    schema = {
        "type": "object",
        "required": ["calls"],
        "properties": {"calls": {"type": "array", "maxItems": 3, "items": {"type": "string"}}},
    }
    p, fake = claude(claude_response("{}"))

    p.complete(replace(REQUEST, output_schema=schema), 10.0)

    sent = fake.messages.calls[0]["output_config"]["format"]["schema"]
    calls = sent["properties"]["calls"]
    # Claude 구조화 출력은 maxItems를 받지 않는다. 개수는 기능 모듈의 검증 함수가 검사한다
    assert "maxItems" not in calls
    assert calls["description"] == "{maxItems: 3}"
    assert calls["items"] == {"type": "string"}
    assert "maxItems" in schema["properties"]["calls"]  # 부른 쪽 스키마는 그대로


def test_claude_returns_text_without_thinking_blocks_and_served_model() -> None:
    p, _ = claude(claude_response('{"answer": ', '"네"}', model="claude-opus-4-8"))

    result = p.complete(REQUEST, 10.0)

    assert result.text == '{"answer": "네"}'
    # 거절 대체로 다른 모델이 답했으면 그 모델이 기록에 남는다
    assert result.model == "claude-opus-4-8"
    assert (result.input_tokens, result.output_tokens) == (120, 45)


def test_claude_adds_cache_tokens_to_input_total() -> None:
    usage = SimpleNamespace(
        input_tokens=40,
        output_tokens=300,
        cache_read_input_tokens=8960,
        cache_creation_input_tokens=1000,
    )
    p, _ = claude(claude_response("{}", usage=usage))

    result = p.complete(REQUEST, 10.0)

    # Claude의 input_tokens는 캐시 토큰을 빼고 세므로 합계로 맞춘다(#633 기록 방식)
    assert result.input_tokens == 10000
    assert result.cached_input_tokens == 8960
    # 추론 토큰 수는 알려 주지 않아 0이 아니라 None이다
    assert result.reasoning_tokens is None


def test_claude_keeps_tokens_none_without_usage() -> None:
    p, _ = claude(claude_response("{}", usage=None))

    result = p.complete(REQUEST, 10.0)

    assert result.input_tokens is None
    assert result.output_tokens is None
    assert result.cached_input_tokens is None


@pytest.mark.parametrize(
    ("stop_reason", "message"), [("refusal", "거절"), ("max_tokens", "토큰 한도")]
)
def test_claude_raises_provider_error_on_refusal_or_truncation(
    stop_reason: str, message: str
) -> None:
    p, _ = claude(claude_response('{"ans', stop_reason=stop_reason))

    with pytest.raises(ProviderError, match=message) as caught:
        p.complete(REQUEST, 10.0)
    assert not isinstance(caught.value, ProviderTransientError)


@pytest.mark.parametrize(
    "error",
    [
        anthropic.APITimeoutError(request=httpx2.Request("POST", "https://api.anthropic.com")),
        anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com")),
        claude_status_error(429, cls=anthropic.RateLimitError),
        claude_status_error(500, cls=anthropic.InternalServerError),
        claude_status_error(529, cls=anthropic.OverloadedError),
        claude_status_error(409, cls=anthropic.ConflictError),
    ],
)
def test_claude_maps_temporary_errors_to_transient(error: Exception) -> None:
    p, _ = claude(error)

    with pytest.raises(ProviderTransientError):
        p.complete(REQUEST, 10.0)


@pytest.mark.parametrize(
    "error",
    [
        claude_status_error(402, body={"type": "error", "error": {"type": "billing_error"}}),
        claude_status_error(
            429,
            body={
                "type": "error",
                "error": {
                    "type": "rate_limit_error",
                    "details": {"error_code": "enforced_spend_limit_reached"},
                },
            },
            cls=anthropic.EnforcedSpendLimitReachedError,
        ),
    ],
)
def test_claude_maps_billing_and_spend_limit_to_quota_error(error: Exception) -> None:
    p, _ = claude(error)

    # 결제·지출 한도는 기다려도 풀리지 않아 다시 시도하지 않는다
    with pytest.raises(ProviderQuotaError) as caught:
        p.complete(REQUEST, 10.0)
    assert not isinstance(caught.value, ProviderTransientError)


@pytest.mark.parametrize(
    ("code", "cls"),
    [
        (401, anthropic.AuthenticationError),
        (403, anthropic.PermissionDeniedError),
        (400, anthropic.BadRequestError),
        (404, anthropic.NotFoundError),
    ],
)
def test_claude_maps_permanent_errors_to_provider_error(code: int, cls: Any) -> None:
    p, _ = claude(claude_status_error(code, cls=cls))

    with pytest.raises(ProviderError) as caught:
        p.complete(REQUEST, 10.0)
    assert not isinstance(caught.value, ProviderTransientError | ProviderQuotaError)


def test_claude_fails_at_call_time_without_api_key() -> None:
    p = create_provider(LlmSettings(provider="anthropic"))

    assert isinstance(p, AnthropicProvider)
    with pytest.raises(ProviderError, match="LLM_API_KEY") as caught:
        p.complete(REQUEST, 10.0)
    assert not isinstance(caught.value, ProviderTransientError)


def test_create_provider_builds_claude_client_without_sdk_retries() -> None:
    settings = LlmSettings(provider="anthropic", api_key=FAKE_KEY, model="claude-haiku-5-5")

    p = create_provider(settings)

    assert isinstance(p, AnthropicProvider)
    assert p.name == "anthropic"
    assert p.model == "claude-haiku-5-5"
    client = p._anthropic()
    assert isinstance(client, anthropic.Anthropic)
    assert client.max_retries == 0


def test_create_provider_uses_claude_default_model() -> None:
    p = create_provider(LlmSettings(provider="anthropic", api_key=FAKE_KEY))

    assert isinstance(p, AnthropicProvider)
    assert p.model == ANTHROPIC_DEFAULT_MODEL


def _walk(node: Any) -> list[dict[str, Any]]:
    if isinstance(node, list):
        return [d for v in node for d in _walk(v)]
    if not isinstance(node, dict):
        return []
    return [node, *(d for v in node.values() for d in _walk(v))]


def test_claude_schema_accepts_every_feature_schema() -> None:
    from app.agent.model import ActionSpec, StepInput, ToolSpec, Turn
    from app.agent.prompt import answer_schema, plan_schema
    from app.briefing.prompt import OUTPUT_SCHEMA as BRIEFING
    from app.events.amount_pick_prompt import OUTPUT_SCHEMA as AMOUNT
    from app.events.meaning_prompt import OUTPUT_SCHEMA as MEANING
    from app.events.prompt import OUTPUT_SCHEMA as EVENTS
    from app.events.signal_reason_prompt import OUTPUT_SCHEMA as SIGNAL
    from app.followup.prompt import OUTPUT_SCHEMA as FOLLOWUP
    from app.llm.providers import (
        CLAUDE_MAX_UNION_FIELDS,
        CLAUDE_UNSUPPORTED_KEYWORDS,
        claude_schema,
        claude_schema_fits,
    )
    from app.outlook.prompt import OUTPUT_SCHEMA as OUTLOOK

    args = {"type": "object", "properties": {}, "required": [], "additionalProperties": False}
    # 실제 채팅처럼 선택 인자가 있는 Tool이 많아도 '여러 타입' 필드 한도를 넘지 않아야 한다(#777)
    optional_args = {
        "type": "object",
        "required": ["section"],
        "properties": {
            "section": {"type": "string"},
            "query": {"type": "string"},
            "priority": {"enum": ["priority", "all"]},
            "limit": {"type": "integer", "minimum": 1, "maximum": 20},
        },
    }
    tools = [ToolSpec(f"tool_{i}", "도구", optional_args) for i in range(30)]

    def step(actions: list[ActionSpec]) -> StepInput:
        history = [Turn("user", "질문")]
        return StepInput("회사", None, "보고서", "질문", history, {}, tools, actions, [], 4)

    # 에이전트 Tool 고르기 밖의 작업은 구조화 출력 한도 안이어야 한다(ADR-0062)
    fitting = [
        SUMMARY_SCHEMA,
        ANSWER_SCHEMA,
        BRIEFING,
        AMOUNT,
        MEANING,
        EVENTS,
        SIGNAL,
        FOLLOWUP,
        OUTLOOK,
        answer_schema(step([ActionSpec("OPEN_TAB", args)])),
    ]
    for schema in fitting:
        assert claude_schema_fits(claude_schema(schema))
    schemas = [
        *fitting,
        plan_schema(step([])),
        plan_schema(step([ActionSpec("OPEN_TAB", args)])),
    ]
    for schema in schemas:
        nodes = _walk(claude_schema(schema))
        unions = [n for n in nodes if isinstance(n.get("type"), list) or "anyOf" in n]
        assert len(unions) <= CLAUDE_MAX_UNION_FIELDS
        for node in nodes:
            assert not set(CLAUDE_UNSUPPORTED_KEYWORDS) & set(node)
            # 타입 목록과 enum을 함께 두면 Claude가 400을 낸다
            assert not (isinstance(node.get("type"), list) and "enum" in node)
            if "properties" in node:
                assert node["additionalProperties"] is False


def test_claude_schema_keeps_optional_properties_optional() -> None:
    from app.llm.providers import claude_schema

    result = claude_schema(SCHEMA)

    # OpenAI 엄격 모드와 달리 선택 속성을 필수·null 허용으로 바꾸지 않는다
    assert result["required"] == ["answer"]
    assert result["properties"]["note"] == {"type": "string"}
    assert result["additionalProperties"] is False
    assert "additionalProperties" not in SCHEMA  # 부른 쪽 스키마는 그대로


def test_claude_schema_splits_enum_with_type_list_into_any_of() -> None:
    from app.llm.providers import claude_schema

    schema = {
        "type": "object",
        "properties": {"grade": {"type": ["string", "null"], "enum": ["STATED", None]}},
    }

    grade = claude_schema(schema)["properties"]["grade"]

    assert grade == {"anyOf": [{"type": "string", "enum": ["STATED"]}, {"type": "null"}]}


def test_claude_sends_schema_too_large_for_structured_output_without_format() -> None:
    optional = {f"field_{i}": {"type": "string"} for i in range(25)}
    schema = {"type": "object", "required": ["answer"], "properties": {"answer": {}, **optional}}
    p, fake = claude(claude_response('{"answer": "네"}'), reasoning_effort="low")

    result = p.complete(replace(REQUEST, output_schema=schema), 10.0)

    # 선택 속성이 24개를 넘으면 400이 나므로 구조화 출력 없이 보내고 검증 함수에 맡긴다
    output_config = fake.messages.calls[0]["output_config"]
    assert "format" not in output_config
    assert output_config["effort"] == "low"
    assert result.text == '{"answer": "네"}'


def test_claude_marks_system_and_shared_user_prefix_for_caching() -> None:
    p, fake = claude(claude_response("{}"))

    p.complete(replace(REQUEST, user="고정된 목록\n바뀌는 질문", user_cache_prefix=6), 10.0)

    params = fake.messages.calls[0]
    # 요청 끝에 두는 자동 캐시는 매번 바뀌는 질문까지 저장하므로 쓰지 않는다
    assert "cache_control" not in params
    assert params["system"] == [
        {"type": "text", "text": "시스템", "cache_control": {"type": "ephemeral"}}
    ]
    assert params["messages"][0]["content"] == [
        {"type": "text", "text": "고정된 목록", "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": "\n바뀌는 질문"},
    ]


def test_claude_sends_whole_user_as_one_block_without_shared_prefix() -> None:
    p, fake = claude(claude_response("{}"))

    p.complete(REQUEST, 10.0)

    assert fake.messages.calls[0]["messages"][0]["content"] == [{"type": "text", "text": "사용자"}]
