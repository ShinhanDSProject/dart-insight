from datetime import datetime
from typing import Any

import pytest

from app.compare.listing import BUSINESS, LITIGATION, MAIN
from app.compare.text_diff import MODIFIED
from app.core.config import LlmSettings
from app.documents.parser import PARAGRAPH
from app.events.candidates import CandidateChange
from app.events.model import FAKE_MODEL, NO_CANDIDATES, EventChange, EventInput
from app.events.service import group_events
from app.llm import FakeProvider, LlmClient, LlmOutputInvalid, LlmUnavailable, ProviderError
from app.llm.client import OUTCOME_ERROR, OUTCOME_INVALID_OUTPUT, OUTCOME_OK

TEXT = "당사는 소송에서 패소하여 1,200억원을 지급했습니다."


class ScriptedProvider(FakeProvider):
    """정해 둔 응답을 돌려주는 진짜 제공자 역할. fake 구분(FAKE_MODEL)에 걸리지 않는다."""

    name = "scripted"


def llm(*script: object) -> tuple[LlmClient, ScriptedProvider]:
    provider = ScriptedProvider(script=script, model="scripted-model")
    settings = LlmSettings(provider="scripted", max_retries=0, max_output_retries=2)
    return LlmClient(provider, settings, sleep=lambda _: None), provider


def change(no: int, field: str | None = LITIGATION) -> EventChange:
    return EventChange(
        no,
        CandidateChange(MODIFIED, PARAGRAPH, MAIN, field, False, "XI. 그 밖에"),
        None,
        no * 10,
        None,
        TEXT,
    )


def event_input(*changes: EventChange) -> EventInput:
    return EventInput("20250814003156", "20260814003699", list(changes))


def event(no: int = 1, **overrides: Any) -> dict[str, Any]:
    quote = {"changeNo": no, "purpose": "CHANGE", "side": "CURRENT", "text": "소송에서 패소하여"}
    return {"title": "소송 패소", "kind": "소송", "changeNos": [no], "quotes": [quote]} | overrides


def test_events_with_model_version_time_and_unbound_changes_are_returned() -> None:
    client, _ = llm({"events": [event(1)]})

    output = group_events(client, event_input(change(1), change(2)))

    assert output.created is True
    assert output.not_created_reason is None
    assert output.model == "scripted-model"
    assert output.prompt_version == "text-event-1"
    assert output.generated_at is not None
    assert output.dropped_event_count == 0
    assert [e.change_nos for e in output.events] == [[1]]
    assert output.unbound_change_nos == [2]
    assert [c.outcome for c in output.calls] == [OUTCOME_OK]


def test_only_candidates_are_sent_and_counted_as_unbound() -> None:
    client, provider = llm({"events": []})

    output = group_events(client, event_input(change(1), change(2, field=BUSINESS)))

    assert 'id="2"' not in provider.requests[0].user
    assert output.unbound_change_nos == [1]


def test_change_that_is_not_a_candidate_cannot_be_bound() -> None:
    bound = {"events": [event(2)]}
    client, _ = llm(bound, bound, bound)

    with pytest.raises(LlmOutputInvalid):
        group_events(client, event_input(change(1), change(2, field=BUSINESS)))


def test_events_are_in_change_order_regardless_of_model_order() -> None:
    client, _ = llm({"events": [event(2), event(1)]})

    output = group_events(client, event_input(change(1), change(2)))

    assert [e.change_nos for e in output.events] == [[1], [2]]


def test_fake_provider_does_not_call_model_and_reports_not_created() -> None:
    provider = FakeProvider()
    client = LlmClient(provider, LlmSettings(provider="fake"))

    output = group_events(client, event_input(change(1)))

    assert output.created is False
    assert output.not_created_reason == FAKE_MODEL
    assert output.model is None
    assert output.generated_at is None
    assert output.events == []
    assert output.unbound_change_nos == []
    assert output.calls == []
    assert provider.requests == []


def test_no_candidates_does_not_call_model() -> None:
    client, provider = llm()

    output = group_events(client, event_input(change(1, field=BUSINESS)))

    assert output.created is False
    assert output.not_created_reason == NO_CANDIDATES
    assert provider.requests == []


def test_no_candidates_wins_over_fake_provider() -> None:
    client = LlmClient(FakeProvider(), LlmSettings(provider="fake"))

    output = group_events(client, event_input())

    assert output.not_created_reason == NO_CANDIDATES


def test_regenerated_output_replaces_the_broken_one() -> None:
    client, provider = llm({"events": [event(1, title="1,500억원 패소")]}, {"events": [event(1)]})

    output = group_events(client, event_input(change(1)))

    assert output.dropped_event_count == 0
    assert output.events[0].title == "소송 패소"
    assert [c.outcome for c in output.calls] == [OUTCOME_INVALID_OUTPUT, OUTCOME_OK]
    assert "1번 사건" in provider.requests[1].user


def test_event_still_broken_after_two_retries_is_dropped_and_its_changes_are_unbound() -> None:
    broken = {"events": [event(1), event(2, title="1,500억원 패소")]}
    client, provider = llm(broken, broken, broken)

    output = group_events(client, event_input(change(1), change(2)))

    assert len(provider.requests) == 3
    assert output.created is True
    assert output.dropped_event_count == 1
    assert [e.change_nos for e in output.events] == [[1]]
    assert output.unbound_change_nos == [2]
    assert output.model == "scripted-model"
    assert output.generated_at is not None
    assert [c.outcome for c in output.calls] == [OUTCOME_INVALID_OUTPUT] * 3


def test_generated_at_is_from_the_call_that_produced_kept_events_when_retry_call_fails() -> None:
    times = iter([datetime(2026, 11, 5, 10, 0, 0), datetime(2026, 11, 5, 10, 5, 0)])
    provider = ScriptedProvider(
        script=[
            {"events": [event(1), event(2, title="1,500억원 패소")]},
            ProviderError("인증 실패"),
        ],
        model="scripted-model",
    )
    settings = LlmSettings(provider="scripted", max_retries=0, max_output_retries=2)
    client = LlmClient(provider, settings, sleep=lambda _: None, clock=lambda: next(times))

    output = group_events(client, event_input(change(1), change(2)))

    assert [c.outcome for c in output.calls] == [OUTCOME_INVALID_OUTPUT, OUTCOME_ERROR]
    assert [e.change_nos for e in output.events] == [[1]]
    assert output.generated_at == "2026-11-05T10:00:00"


def test_change_bound_to_a_kept_event_is_not_unbound_when_another_event_is_dropped() -> None:
    other = event(1, title="1,500억원 패소")
    client, _ = llm(*[{"events": [event(1), other]}] * 3)

    output = group_events(client, event_input(change(1)))

    assert output.dropped_event_count == 1
    assert output.unbound_change_nos == []


def test_no_usable_event_after_retries_raises_with_call_records() -> None:
    broken = {"events": [event(1, title="지금 매수 추천")]}
    client, _ = llm(broken, broken, broken)

    with pytest.raises(LlmOutputInvalid) as caught:
        group_events(client, event_input(change(1)))

    assert [c.outcome for c in caught.value.calls] == [OUTCOME_INVALID_OUTPUT] * 3


def test_unreadable_output_after_retries_raises() -> None:
    client, _ = llm("JSON 아님", "JSON 아님", "JSON 아님")

    with pytest.raises(LlmOutputInvalid):
        group_events(client, event_input(change(1)))


def test_model_answering_no_events_is_not_a_failure() -> None:
    client, provider = llm({"events": []})

    output = group_events(client, event_input(change(1)))

    assert len(provider.requests) == 1
    assert output.created is True
    assert output.events == []
    assert output.unbound_change_nos == [1]


def test_provider_failure_raises_unavailable_with_call_records() -> None:
    client, _ = llm(ProviderError("인증 실패"))

    with pytest.raises(LlmUnavailable) as caught:
        group_events(client, event_input(change(1)))

    assert len(caught.value.calls) == 1


def test_no_provider_raises_unavailable() -> None:
    client = LlmClient(None, LlmSettings(provider=""))

    with pytest.raises(LlmUnavailable):
        group_events(client, event_input(change(1)))
