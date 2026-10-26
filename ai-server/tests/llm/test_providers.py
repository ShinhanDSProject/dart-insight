from types import SimpleNamespace
from typing import Any

import httpx
import openai
import pytest

from app.answer.prompt import OUTPUT_SCHEMA as ANSWER_SCHEMA
from app.core.config import LlmSettings, load_llm_settings
from app.llm import LlmRequest, ProviderError, ProviderTransientError
from app.llm.providers import (
    OPENAI_DEFAULT_MODEL,
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
    assert result["required"] == ["status", "answer", "evidenceIds", "factRefs"]
