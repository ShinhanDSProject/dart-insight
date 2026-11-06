from typing import Any

import pytest

from app.compare.listing import LITIGATION, MAIN
from app.compare.text_diff import MODIFIED
from app.core.config import LlmSettings
from app.documents.parser import PARAGRAPH
from app.events.candidates import CandidateChange
from app.events.meaning import check_meaning, not_written, write_meaning
from app.events.meaning_prompt import PROMPT_VERSION, event_blocks
from app.events.model import (
    ABSENT,
    BUDGET_EXCEEDED,
    CAUTION,
    CURRENT,
    FACT,
    FAILED,
    GENERATED,
    INVALID_OUTPUT,
    LLM_UNAVAILABLE,
    EventChange,
    EventInput,
    EventScale,
    EventSignal,
    Quote,
    SentenceItem,
    TextEvent,
)
from app.llm import FakeProvider, LlmClient, OutputProblem, ProviderError
from app.llm.client import OUTCOME_ERROR, OUTCOME_INVALID_OUTPUT, OUTCOME_OK

PREVIOUS_RCEPT = "20250814003156"
CURRENT_RCEPT = "20260814003699"
CURRENT_ID = f"{CURRENT_RCEPT}#B1576"
PREVIOUS_ID = f"{PREVIOUS_RCEPT}#B2028"
PREVIOUS_TEXT = "당사는 ㈜한빛을 상대로 소송을 진행하고 있습니다."
PNL = "PNL_IMPACT"
CURRENT_TEXT = "당사는 2026년 3월 5일 2025가합12345 소송에서 패소했습니다. 배상금은 100억원입니다."


class ScriptedProvider(FakeProvider):
    name = "scripted"


def llm(*script: object) -> tuple[LlmClient, ScriptedProvider]:
    provider = ScriptedProvider(script=script, model="scripted-model")
    settings = LlmSettings(provider="scripted", max_retries=0, max_output_retries=2)
    return LlmClient(provider, settings, sleep=lambda _: None), provider


def data(current_text: str = CURRENT_TEXT) -> EventInput:
    change = EventChange(
        12,
        CandidateChange(MODIFIED, PARAGRAPH, MAIN, LITIGATION, False, "XI. 그 밖에"),
        2028,
        1576,
        PREVIOUS_TEXT,
        current_text,
    )
    return EventInput(PREVIOUS_RCEPT, CURRENT_RCEPT, [change])


def event(scale: EventScale | None = None) -> TextEvent:
    return TextEvent(
        "소송 패소",
        "소송",
        [12],
        [Quote(12, "CHANGE", CURRENT, "소송에서 패소했습니다", CURRENT_ID)],
        scale or EventScale(),
        signal=EventSignal("LITIGATION", "LOST", "패소", CAUTION),
    )


def item(text: str = "진행 중이던 소송에서 회사가 졌어요.", **overrides: Any) -> dict[str, Any]:
    return {"type": FACT, "absentTopics": [], "text": text, "evidenceIds": [CURRENT_ID]} | overrides


def absent(topics: list[str], evidence: str = PREVIOUS_ID) -> dict[str, Any]:
    return item("그 내용은 이 문단에 적혀 있지 않아요.", type=ABSENT, absentTopics=topics) | {
        "evidenceIds": [evidence]
    }


def checked(*items: Any, scale: EventScale | None = None, text: str = CURRENT_TEXT) -> Any:
    source = data(text)
    return check_meaning(
        {"items": list(items)}, event(scale), event_blocks(event(), source), source
    )


def problems_of(*items: Any, scale: EventScale | None = None, text: str = CURRENT_TEXT) -> str:
    with pytest.raises(OutputProblem) as caught:
        checked(*items, scale=scale, text=text)
    return " ".join(caught.value.problems)


def test_valid_sentences_are_returned_with_evidence() -> None:
    result = checked(item(), absent(["PNL_IMPACT"]))

    assert result == (
        SentenceItem(FACT, "진행 중이던 소송에서 회사가 졌어요.", (CURRENT_ID,)),
        SentenceItem(ABSENT, "그 내용은 이 문단에 적혀 있지 않아요.", (PREVIOUS_ID,), (PNL,)),
    )


def test_amount_date_case_number_and_company_from_the_cited_source_pass() -> None:
    text = "2026년 3월 5일 2025가합12345 소송에서 졌고 배상금은 100억원이에요."

    assert checked(item(text))[0].text == text


def test_fact_not_in_the_cited_source_fails() -> None:
    assert "날짜" in problems_of(item("2026년 4월 1일에 졌어요."))
    assert "숫자" in problems_of(item("배상금은 200억원이에요."))
    assert "원문에 없는" in problems_of(item("2025가합99999 소송에서 졌어요."))
    assert "이름" in problems_of(item("㈜두리를 상대로 한 소송이에요."))


def test_fact_must_be_in_the_block_it_cites() -> None:
    """회사 이름은 이전 글에만 있다. 이번 글만 근거로 들면 원문에 없는 것이다."""
    assert "이름" in problems_of(item("㈜한빛을 상대로 한 소송에서 졌어요."))
    cited_both = item("㈜한빛을 상대로 한 소송에서 졌어요.", evidenceIds=[PREVIOUS_ID, CURRENT_ID])

    assert checked(cited_both)


def test_count_or_ratio_not_given_by_code_fails() -> None:
    assert "원문에 없는" in problems_of(item("소송 2건에서 졌어요."))


def test_ratio_given_by_code_passes() -> None:
    scale = EventScale(amount=10_000_000_000, text="100억원", ratio=0.0123)

    assert checked(item("배상금은 자본총계의 1.23%예요."), scale=scale)


def test_evidence_outside_the_event_blocks_fails() -> None:
    assert "evidenceIds" in problems_of(item(evidenceIds=[f"{CURRENT_RCEPT}#B9999"]))
    assert "evidenceIds" in problems_of(item(evidenceIds=[]))
    assert "evidenceIds" in problems_of(item(evidenceIds=[[CURRENT_ID]]))
    assert "evidenceIds" in problems_of(item(evidenceIds=CURRENT_ID))


def test_absent_sentence_needs_topics_and_fact_sentence_has_none() -> None:
    assert "absentTopics" in problems_of(item(), absent([]))
    assert "absentTopics" in problems_of(item(absentTopics=["AMOUNT"]))
    assert "absentTopics" in problems_of(item(), absent(["PRICE"]))


def test_absent_amount_fails_when_the_checked_range_has_an_amount() -> None:
    assert "금액" in problems_of(item(), absent(["AMOUNT"], evidence=CURRENT_ID))


def test_absent_amount_passes_when_the_checked_range_has_no_amount() -> None:
    assert checked(item(), absent(["AMOUNT"], evidence=PREVIOUS_ID))


def test_absent_amount_fails_when_code_found_the_event_amount() -> None:
    scale = EventScale(amount=10_000_000_000, text="100억원")

    assert "금액" in problems_of(item(), absent(["AMOUNT"]), scale=scale)


def test_absent_schedule_fails_when_the_checked_range_has_a_date() -> None:
    assert "날짜" in problems_of(item(), absent(["SCHEDULE"], evidence=CURRENT_ID))
    assert checked(item(), absent(["SCHEDULE"], evidence=PREVIOUS_ID))


def test_at_least_one_fact_sentence_is_needed() -> None:
    assert "FACT" in problems_of(absent(["PNL_IMPACT"]))


def test_too_many_or_too_long_sentences_fail() -> None:
    assert "문장" in problems_of(*[item()] * 5)
    assert "자" in problems_of(item("가" * 201))


def test_investment_advice_fails() -> None:
    assert "투자 권유" in problems_of(item("지금 매수하세요."))
    assert "투자 권유" in problems_of(item("목표주가가 올라요."))
    assert "투자 권유" in problems_of(item("주가가 오를 것으로 예상돼요."))


def test_cause_is_written_only_when_the_source_states_it() -> None:
    assert "원인" in problems_of(item("소송 때문에 졌어요."))


def test_meaning_is_generated_with_model_version_and_time() -> None:
    client, _ = llm({"items": [item()]})

    written = write_meaning(client, event(), data())

    sentence = written.sentence
    assert sentence.status == GENERATED
    assert sentence.fail_reason is None
    assert sentence.items[0].evidence_ids == (CURRENT_ID,)
    assert (sentence.model, sentence.prompt_version) == ("scripted-model", PROMPT_VERSION)
    assert sentence.generated_at is not None
    assert [c.outcome for c in written.calls] == [OUTCOME_OK]
    assert written.unavailable is False


def test_meaning_is_regenerated_with_the_problem() -> None:
    client, provider = llm({"items": [item("지금 매수하세요.")]}, {"items": [item()]})

    written = write_meaning(client, event(), data())

    assert written.sentence.status == GENERATED
    assert [c.outcome for c in written.calls] == [OUTCOME_INVALID_OUTPUT, OUTCOME_OK]
    assert "투자 권유" in provider.requests[1].user


def test_meaning_that_keeps_failing_is_not_shown_and_recorded_as_failed() -> None:
    bad = {"items": [item("지금 매수하세요.")]}
    client, _ = llm(bad, bad, bad)

    written = write_meaning(client, event(), data())

    sentence = written.sentence
    assert (sentence.status, sentence.fail_reason) == (FAILED, INVALID_OUTPUT)
    assert sentence.items == ()
    assert [c.outcome for c in written.calls] == [OUTCOME_INVALID_OUTPUT] * 3
    assert (sentence.model, sentence.prompt_version) == ("scripted-model", PROMPT_VERSION)
    assert written.unavailable is False


def test_provider_failure_is_llm_unavailable() -> None:
    client, _ = llm(ProviderError("인증 실패"))

    written = write_meaning(client, event(), data())

    assert (written.sentence.status, written.sentence.fail_reason) == (FAILED, LLM_UNAVAILABLE)
    assert [c.outcome for c in written.calls] == [OUTCOME_ERROR]
    assert written.unavailable is True


def test_provider_failure_while_regenerating_is_llm_unavailable() -> None:
    client, _ = llm({"items": [item("지금 매수하세요.")]}, ProviderError("인증 실패"))

    written = write_meaning(client, event(), data())

    assert written.sentence.fail_reason == LLM_UNAVAILABLE
    assert written.unavailable is True


def test_not_written_sentence_has_no_call_information() -> None:
    sentence = not_written(BUDGET_EXCEEDED)

    assert (sentence.status, sentence.fail_reason) == (FAILED, BUDGET_EXCEEDED)
    assert (sentence.model, sentence.prompt_version, sentence.generated_at) == (None, None, None)
