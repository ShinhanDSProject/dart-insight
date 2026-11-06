import threading
from typing import Any

from app.compare.listing import LITIGATION, MAIN
from app.compare.text_diff import MODIFIED
from app.core.config import LlmSettings
from app.core.context import trace_id_var
from app.documents.parser import PARAGRAPH
from app.events.candidates import CandidateChange
from app.events.meaning_prompt import TASK
from app.events.model import (
    BUDGET_EXCEEDED,
    CAUTION,
    CURRENT,
    FAILED,
    GENERATED,
    LLM_UNAVAILABLE,
    EventChange,
    EventInput,
    EventSignal,
    Quote,
    TextEvent,
)
from app.events.sentences import MAX_CONCURRENT_CALLS, SENTENCE_BUDGET_SECONDS, write_sentences
from app.llm import FakeProvider, LlmClient, LlmRequest, ProviderError
from app.llm.providers import ProviderResponse

CURRENT_RCEPT = "20260814003699"


class ScriptedProvider(FakeProvider):
    name = "scripted"


def evidence_of(no: int) -> str:
    return f"{CURRENT_RCEPT}#B{no * 10}"


def answer(request: LlmRequest) -> dict[str, Any]:
    """첫 블록을 근거로 든 문장. 사건마다 근거가 달라 결과가 섞이면 드러난다."""
    first = request.context[0].evidence_id
    return {
        "items": [
            {"type": "FACT", "absentTopics": [], "text": "소송에서 졌어요.", "evidenceIds": [first]}
        ]
    }


def llm(provider: FakeProvider | None = None) -> LlmClient:
    provider = provider or ScriptedProvider(responders={TASK: answer}, model="scripted-model")
    settings = LlmSettings(provider="scripted", max_retries=0, max_output_retries=2)
    return LlmClient(provider, settings, sleep=lambda _: None)


def data(count: int) -> EventInput:
    changes = [
        EventChange(
            no,
            CandidateChange(MODIFIED, PARAGRAPH, MAIN, LITIGATION, False, "XI"),
            None,
            no * 10,
            None,
            "당사는 소송에서 졌습니다.",
        )
        for no in range(1, count + 1)
    ]
    return EventInput("20250814003156", CURRENT_RCEPT, changes)


def events(count: int) -> list[TextEvent]:
    return [
        TextEvent(
            f"사건 {no}",
            "소송",
            [no],
            [Quote(no, "CHANGE", CURRENT, "소송에서 졌습니다", evidence_of(no))],
            signal=EventSignal("LITIGATION", "LOST", "패소", CAUTION),
        )
        for no in range(1, count + 1)
    ]


def test_each_event_gets_its_own_meaning_in_event_order() -> None:
    written, calls = write_sentences(llm(), data(9), events(9))

    assert [e.meaning.status for e in written if e.meaning] == [GENERATED] * 9
    assert [e.meaning.items[0].evidence_ids for e in written if e.meaning] == [
        (evidence_of(no),) for no in range(1, 10)
    ]
    assert [c.task for c in calls] == [TASK] * 9


def test_calls_are_listed_in_event_order_even_when_answers_come_back_out_of_order() -> None:
    class SlowFirst(ScriptedProvider):
        def complete(self, request: LlmRequest, timeout_seconds: float) -> ProviderResponse:
            if request.context[0].evidence_id == evidence_of(1):
                threading.Event().wait(0.05)
            return super().complete(request, timeout_seconds)

    provider = SlowFirst(responders={TASK: answer}, model="scripted-model")
    written, calls = write_sentences(llm(provider), data(3), events(3))

    assert [c.called_at is not None for c in calls] == [True] * 3
    assert [e.meaning.items[0].evidence_ids[0] for e in written if e.meaning] == [
        evidence_of(no) for no in range(1, 4)
    ]


def test_calls_run_at_most_four_at_a_time() -> None:
    running = 0
    most = 0
    lock = threading.Lock()

    class Counting(ScriptedProvider):
        def complete(self, request: LlmRequest, timeout_seconds: float) -> ProviderResponse:
            nonlocal running, most
            with lock:
                running += 1
                most = max(most, running)
            threading.Event().wait(0.02)
            with lock:
                running -= 1
            return super().complete(request, timeout_seconds)

    write_sentences(llm(Counting(responders={TASK: answer})), data(10), events(10))

    assert MAX_CONCURRENT_CALLS == 4
    assert 1 < most <= MAX_CONCURRENT_CALLS


def test_trace_id_of_the_request_is_kept_in_calls_from_other_threads() -> None:
    token = trace_id_var.set("evt-trace")
    try:
        _, calls = write_sentences(llm(), data(5), events(5))
    finally:
        trace_id_var.reset(token)

    assert {c.trace_id for c in calls} == {"evt-trace"}


def test_events_after_the_budget_are_not_called() -> None:
    times = iter([0.0, 0.0, SENTENCE_BUDGET_SECONDS])

    written, calls = write_sentences(
        llm(), data(3), events(3), monotonic=lambda: next(times, SENTENCE_BUDGET_SECONDS), workers=1
    )

    assert SENTENCE_BUDGET_SECONDS == 300.0
    statuses = [(e.meaning.status, e.meaning.fail_reason) for e in written if e.meaning]
    assert statuses == [(GENERATED, None), (FAILED, BUDGET_EXCEEDED), (FAILED, BUDGET_EXCEEDED)]
    assert len(calls) == 1


def test_events_after_the_llm_becomes_unavailable_are_not_called() -> None:
    provider = ScriptedProvider(script=[ProviderError("인증 실패")], responders={TASK: answer})

    written, calls = write_sentences(llm(provider), data(3), events(3), workers=1)

    assert [e.meaning.fail_reason for e in written if e.meaning] == [LLM_UNAVAILABLE] * 3
    assert len(calls) == 1


def test_no_events_make_no_calls() -> None:
    assert write_sentences(llm(), data(0), []) == ([], [])
