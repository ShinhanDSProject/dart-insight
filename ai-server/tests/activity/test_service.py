import copy

from app.activity import fake
from app.activity.model import EMPTY, GENERATED, HOLD, REVIEW_NEEDED, ActivityInput
from app.activity.prompt import OVERVIEW_TASK, PROMPT_VERSION, TASK, build_request
from app.activity.service import NOT_VERIFIED, summarize
from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient
from tests.activity.test_validate import ACTIVITY, GOOD

SETTINGS = LlmSettings(provider="fake", max_retries=0, max_output_retries=2)


def client(*script: object) -> tuple[LlmClient, FakeProvider]:
    responders = {TASK: fake.respond, OVERVIEW_TASK: fake.respond_overview}
    provider = FakeProvider(script=script, responders=responders)
    return LlmClient(provider, SETTINGS, sleep=lambda _: None), provider


def test_fake_responder_passes_validation_with_hold_signal() -> None:
    llm, _ = client()

    output = summarize(llm, ACTIVITY)

    assert output.result.status == GENERATED
    assert output.model == "fake-model"
    assert output.prompt_version == PROMPT_VERSION
    assert [i.signal.signal for i in output.result.items] == [HOLD, HOLD]
    assert output.result.overview is not None


def test_no_sources_is_empty_without_calling_llm() -> None:
    llm, provider = client()

    output = summarize(llm, ActivityInput("예시전자", "이전", "이번", []))

    assert output.result.status == EMPTY
    assert output.calls == []


def test_invalid_output_is_retried_then_used() -> None:
    bad = copy.deepcopy(GOOD)
    bad["items"][0]["area"] = "NOPE"
    llm, _ = client(bad, GOOD)

    output = summarize(llm, ACTIVITY)

    assert output.result.status == GENERATED
    assert len(output.calls) == 3  # 카드 2번(다시 만듦) + 요약·타임라인 1번


def test_failing_items_are_dropped_after_retries() -> None:
    mixed = copy.deepcopy(GOOD)
    mixed["items"].append({"area": "NOPE"})
    llm, _ = client(mixed, mixed, mixed)

    output = summarize(llm, ACTIVITY)

    assert output.result.status == GENERATED
    assert len(output.result.items) == 1
    assert output.result.dropped_count == 1


def test_review_needed_when_nothing_passes() -> None:
    bad = {"items": [{"area": "NOPE"}]}
    llm, _ = client(bad, bad, bad)

    output = summarize(llm, ACTIVITY)

    assert output.result.status == REVIEW_NEEDED
    assert output.result.review_reason == NOT_VERIFIED
    assert output.result.items == []


def test_prompt_wraps_sources_in_disclosure_tags() -> None:
    request = build_request(ACTIVITY)

    assert request.user.count("<disclosure ") == len(ACTIVITY.sources)
    assert 'side="CURRENT"' in request.user
    assert "MAJOR_CONTRACT" in request.system
