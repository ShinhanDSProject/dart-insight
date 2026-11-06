from typing import Any

import pytest

from app.compare.listing import LITIGATION, MAIN
from app.compare.text_diff import MODIFIED
from app.core.config import LlmSettings
from app.documents.parser import PARAGRAPH
from app.events.candidates import CandidateChange
from app.events.meaning_prompt import event_blocks
from app.events.model import (
    BUDGET_EXCEEDED,
    CAUTION,
    CURRENT,
    FALLBACK,
    GENERATED,
    HOLD,
    INVALID_OUTPUT,
    LLM_UNAVAILABLE,
    MIXED_LITIGATION,
    MIXED_SIDES,
    EventChange,
    EventInput,
    EventSignal,
    Quote,
    SentenceItem,
    TextEvent,
)
from app.events.signal_reason import check_reason, fallback, write_signal_reason
from app.events.signal_reason_prompt import PROMPT_VERSION
from app.llm import FakeProvider, LlmClient, OutputProblem, ProviderError
from app.llm.client import OUTCOME_INVALID_OUTPUT, OUTCOME_OK

PREVIOUS_RCEPT = "20250814003156"
CURRENT_RCEPT = "20260814003699"
CURRENT_ID = f"{CURRENT_RCEPT}#B1576"
PREVIOUS_ID = f"{PREVIOUS_RCEPT}#B2028"
CURRENT_TEXT = "당사는 2026년 3월 5일 공정거래위원회로부터 과징금 30억원을 부과받았습니다."
SANCTION_GENERAL = (
    "당국이나 기관의 제재를 받은 것이라, 과징금·과태료나 영업 제한 같은 부담이 생길 수 있어요."
)


class ScriptedProvider(FakeProvider):
    name = "scripted"


def llm(*script: object) -> tuple[LlmClient, ScriptedProvider]:
    provider = ScriptedProvider(script=script, model="scripted-model")
    settings = LlmSettings(provider="scripted", max_retries=0, max_output_retries=2)
    return LlmClient(provider, settings, sleep=lambda _: None), provider


def data() -> EventInput:
    change = EventChange(
        12,
        CandidateChange(MODIFIED, PARAGRAPH, MAIN, LITIGATION, False, "XI. 그 밖에"),
        2028,
        1576,
        "당사는 공정거래위원회의 조사를 받고 있습니다.",
        CURRENT_TEXT,
    )
    return EventInput(PREVIOUS_RCEPT, CURRENT_RCEPT, [change])


def event(
    kind: str = "SANCTION",
    change: str = "OCCURRED",
    name: str = "새로 발생",
    signal: str = CAUTION,
    hold: str | None = None,
) -> TextEvent:
    return TextEvent(
        "과징금 부과",
        "제재",
        [12],
        [Quote(12, "CHANGE", CURRENT, "과징금 30억원을 부과받았습니다", CURRENT_ID)],
        signal=EventSignal(kind, change, name, signal, hold),
    )


def mixed_sides() -> TextEvent:
    return event("TREASURY_STOCK", "ACQUIRED", "취득", HOLD, MIXED_SIDES)


def mixed_litigation() -> TextEvent:
    return event("LITIGATION", "LOST", "패소", HOLD, MIXED_LITIGATION)


def item(
    kind: str = "REASON", text: str = "당국이 과징금을 부과했어요.", **extra: Any
) -> dict[str, Any]:
    return {"type": kind, "text": text, "evidenceIds": [CURRENT_ID]} | extra


def checked(e: TextEvent, *items: Any) -> Any:
    source = data()
    return check_reason({"items": list(items)}, e, event_blocks(e, source), source)


def problems_of(e: TextEvent, *items: Any) -> str:
    with pytest.raises(OutputProblem) as caught:
        checked(e, *items)
    return " ".join(caught.value.problems)


def test_two_or_three_reasons_with_evidence_pass_for_a_signed_event() -> None:
    result = checked(event(), item(), item(text="과징금은 30억원이에요."))

    assert result == (
        SentenceItem("REASON", "당국이 과징금을 부과했어요.", (CURRENT_ID,)),
        SentenceItem("REASON", "과징금은 30억원이에요.", (CURRENT_ID,)),
    )


def test_signed_event_needs_two_to_three_reasons() -> None:
    assert "2~3" in problems_of(event(), item())
    assert "2~3" in problems_of(event(), *[item()] * 4)


def test_signed_event_takes_only_reasons() -> None:
    assert "REASON" in problems_of(event(), item(), item("GOOD"))


def test_mixed_sides_need_a_good_and_a_bad_side() -> None:
    good = item("GOOD", "공시에 자기주식을 취득했다고 적혀 있어요.")
    bad = item("BAD", "자기주식을 사는 데 현금이 쓰였을 수 있어요.")

    assert len(checked(mixed_sides(), good, bad)) == 2
    assert "BAD 문장" in problems_of(mixed_sides(), good)
    assert "GOOD 문장" in problems_of(mixed_sides(), bad, bad)
    assert "GOOD" in problems_of(mixed_sides(), good, bad, item())


def test_mixed_litigation_writes_only_why_it_was_not_judged() -> None:
    why = item("WHY_HOLD", "여러 소송의 진행 상황이 한 표에 함께 바뀌었어요.")

    assert len(checked(mixed_litigation(), why)) == 1
    assert "WHY_HOLD" in problems_of(mixed_litigation(), why, item("GOOD"))
    assert "WHY_HOLD" in problems_of(mixed_litigation(), *[why] * 3)


def test_reason_needs_evidence_from_the_event_blocks() -> None:
    assert "evidenceIds" in problems_of(event(), item(), item(evidenceIds=["x#B1"]))
    assert "evidenceIds" in problems_of(event(), item(), item(evidenceIds=[1]))


def test_reason_fact_must_be_in_the_cited_source() -> None:
    assert "원문에 없는" in problems_of(event(), item(), item(text="과징금은 50억원이에요."))
    assert "원문에 없는" in problems_of(
        event(), item(), item(text="과징금은 30억원이에요.", evidenceIds=[PREVIOUS_ID])
    )


def test_reason_with_advice_or_value_judgment_fails() -> None:
    assert "투자 권유" in problems_of(event(), item(), item(text="악재라서 매도하세요."))
    assert "투자 권유" in problems_of(event(), item(), item(text="주가가 하락할 것으로 보여요."))


def test_cause_is_written_only_when_the_source_states_it() -> None:
    assert "원인" in problems_of(event(), item(), item(text="조사 때문에 과징금을 받았어요."))


def test_reason_is_generated_with_model_version_and_time() -> None:
    client, _ = llm({"items": [item(), item()]})

    written = write_signal_reason(client, event(), data())

    sentence = written.sentence
    assert sentence.status == GENERATED
    assert (sentence.model, sentence.prompt_version) == ("scripted-model", PROMPT_VERSION)
    assert sentence.generated_at is not None
    assert [c.outcome for c in written.calls] == [OUTCOME_OK]


def test_reason_that_keeps_failing_falls_back_to_the_general_phrase() -> None:
    bad = {"items": [item(text="지금 매수하세요."), item()]}
    client, _ = llm(bad, bad, bad)

    written = write_signal_reason(client, event(), data())

    sentence = written.sentence
    assert (sentence.status, sentence.fail_reason) == (FALLBACK, INVALID_OUTPUT)
    assert sentence.items == (SentenceItem("GENERAL", SANCTION_GENERAL, ()),)
    assert [c.outcome for c in written.calls] == [OUTCOME_INVALID_OUTPUT] * 3
    assert sentence.prompt_version == PROMPT_VERSION


def test_provider_failure_falls_back_and_marks_the_llm_unavailable() -> None:
    client, _ = llm(ProviderError("인증 실패"))

    written = write_signal_reason(client, event(), data())

    assert (written.sentence.status, written.sentence.fail_reason) == (FALLBACK, LLM_UNAVAILABLE)
    assert written.unavailable is True


def test_fallback_of_mixed_sides_is_the_good_then_the_bad_general_side() -> None:
    sentence = fallback(mixed_sides(), BUDGET_EXCEEDED)

    assert [i.type for i in sentence.items] == ["GENERAL", "GENERAL"]
    assert "지분 비율이 높아질 수 있어요" in sentence.items[0].text
    assert "현금이 나가고" in sentence.items[1].text
    assert (sentence.model, sentence.prompt_version, sentence.generated_at) == (None, None, None)


def test_fallback_of_mixed_litigation_has_no_phrase() -> None:
    sentence = fallback(mixed_litigation(), INVALID_OUTPUT)

    assert (sentence.status, sentence.fail_reason, sentence.items) == (FALLBACK, INVALID_OUTPUT, ())
