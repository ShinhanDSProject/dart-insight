from typing import Any

from app.compare.listing import HEADING, LITIGATION, MAIN, UNPAIRED
from app.compare.text_diff import ADDED, MODIFIED
from app.documents.parser import PARAGRAPH
from app.events.candidates import CandidateChange
from app.events.model import TEXT_LIMIT, EventChange, EventInput, Quote
from app.events.validate import check

PREVIOUS_RCEPT = "20250814003156"
CURRENT_RCEPT = "20260814003699"
PREVIOUS_TEXT = "당사는 소송을 진행하고 있습니다."
CURRENT_TEXT = "당사는 2026년 3월 5일 소송에서 패소하여 1,200억원을 지급했습니다."


def change(
    no: int = 12,
    previous_block: int | None = 2028,
    current_block: int | None = 1576,
    previous_text: str | None = PREVIOUS_TEXT,
    current_text: str | None = CURRENT_TEXT,
    group: str = MAIN,
) -> EventChange:
    return EventChange(
        no,
        CandidateChange(MODIFIED, PARAGRAPH, group, LITIGATION, False, "XI. 그 밖에 > 2. 우발부채"),
        previous_block,
        current_block,
        previous_text,
        current_text,
    )


def event_input(*changes: EventChange) -> EventInput:
    return EventInput(PREVIOUS_RCEPT, CURRENT_RCEPT, list(changes or [change()]))


def quote(
    change_no: int = 12,
    purpose: str = "CHANGE",
    side: str = "CURRENT",
    text: str = "소송에서 패소하여",
) -> dict[str, Any]:
    return {"changeNo": change_no, "purpose": purpose, "side": side, "text": text}


def event(**overrides: Any) -> dict[str, Any]:
    return {
        "title": "소송 패소",
        "kind": "소송",
        "changeNos": [12],
        "quotes": [quote()],
    } | overrides


def problems_of(entry: dict[str, Any], *changes: EventChange) -> list[str]:
    return check({"events": [entry]}, event_input(*changes)).problems


def test_valid_event_gets_evidence_id_from_change_and_side() -> None:
    checked = check(
        {
            "events": [
                event(
                    quotes=[
                        quote(side="PREVIOUS", text="소송을 진행하고"),
                        quote(purpose="REASON"),
                    ]
                )
            ]
        },
        event_input(),
    )

    assert checked.problems == []
    (result,) = checked.events
    assert result.title == "소송 패소"
    assert result.kind == "소송"
    assert result.change_nos == [12]
    assert result.quotes == [
        Quote(12, "CHANGE", "PREVIOUS", "소송을 진행하고", f"{PREVIOUS_RCEPT}#B2028"),
        Quote(12, "REASON", "CURRENT", "소송에서 패소하여", f"{CURRENT_RCEPT}#B1576"),
    ]


def test_empty_events_is_valid() -> None:
    checked = check({"events": []}, event_input())

    assert checked.events == []
    assert checked.problems == []


def test_output_without_events_array_is_a_problem() -> None:
    assert check({"items": []}, event_input()).problems
    assert check(None, event_input()).problems


def test_only_broken_event_is_left_out_and_counted_as_one_problem() -> None:
    broken = event(title="1,500억원 패소")

    checked = check({"events": [event(), broken]}, event_input())

    assert len(checked.events) == 1
    assert len(checked.problems) == 1
    assert checked.problems[0].startswith("2번 사건:")


def test_unknown_change_no_is_a_problem() -> None:
    assert problems_of(event(changeNos=[12, 99]))


def test_non_integer_change_no_is_a_problem() -> None:
    assert problems_of(event(changeNos=["12"]))
    assert problems_of(event(changeNos=[True]))


def test_empty_change_nos_is_a_problem() -> None:
    assert problems_of(event(changeNos=[]))


def test_repeated_change_no_is_kept_once() -> None:
    (result,) = check({"events": [event(changeNos=[12, 12])]}, event_input()).events

    assert result.change_nos == [12]


def test_event_without_change_quote_is_a_problem() -> None:
    assert problems_of(event(quotes=[]))
    assert problems_of(event(quotes=[quote(purpose="REASON")]))


def test_quote_of_change_outside_the_event_is_a_problem() -> None:
    other = change(no=13, previous_block=None, previous_text=None)

    assert problems_of(event(quotes=[quote(change_no=13)]), change(), other)


def test_non_integer_quote_change_no_is_a_problem() -> None:
    assert problems_of(event(changeNos=[1], quotes=[quote(change_no=True)]), change(no=1))


def test_quote_with_different_text_is_a_problem() -> None:
    assert problems_of(event(quotes=[quote(text="소송에서 승소하여")]))


def test_quote_from_other_side_is_a_problem() -> None:
    assert problems_of(event(quotes=[quote(side="PREVIOUS")]))


def test_blank_quote_is_a_problem() -> None:
    assert problems_of(event(quotes=[quote(text="   ")]))


def test_unknown_purpose_or_side_is_a_problem() -> None:
    assert problems_of(event(quotes=[quote(purpose="SUMMARY")]))
    assert problems_of(event(quotes=[quote(side="BOTH")]))


def test_quote_from_section_level_change_without_block_is_a_problem() -> None:
    section = change(previous_block=None, current_block=None, group=UNPAIRED)

    assert problems_of(event(), section)


def test_section_level_change_can_join_event_quoted_from_another_change() -> None:
    section = change(no=13, previous_block=None, current_block=None, group=UNPAIRED)

    (result,) = check(
        {"events": [event(changeNos=[12, 13])]}, event_input(change(), section)
    ).events

    assert result.change_nos == [12, 13]


def test_quote_beyond_text_given_to_model_is_a_problem() -> None:
    long = "가" * TEXT_LIMIT + "끝부분 문장"

    assert problems_of(event(quotes=[quote(text="끝부분 문장")]), change(current_text=long))


def test_quote_written_with_prompt_escapes_is_matched_and_restored() -> None:
    text = "A&B <주> 소송을 제기했습니다."

    (result,) = check(
        {"events": [event(quotes=[quote(text="A&amp;B &lt;주&gt; 소송")])]},
        event_input(change(current_text=text)),
    ).events

    assert result.quotes[0].text == "A&B <주> 소송"


def test_quote_matches_across_different_whitespace() -> None:
    text = "소송을   제기\n했습니다."

    (result,) = check(
        {"events": [event(quotes=[quote(text="소송을 제기 했습니다")])]},
        event_input(change(current_text=text)),
    ).events

    assert result.quotes[0].text == "소송을 제기 했습니다"


def test_blank_or_too_long_title_is_a_problem() -> None:
    assert problems_of(event(title=" "))
    assert problems_of(event(title="가" * 201))


def test_blank_or_too_long_kind_is_a_problem() -> None:
    assert problems_of(event(kind=""))
    assert problems_of(event(kind="가" * 31))


def test_amount_in_title_is_compared_with_change_text() -> None:
    assert problems_of(event(title="1,200억원 지급")) == []
    assert problems_of(event(title="1,300억원 지급"))


def test_title_fact_is_found_in_a_linked_change_only() -> None:
    other = change(no=13, previous_text="청구 금액은 700억원입니다.", current_text=None)
    other_quote = quote()

    assert problems_of(event(title="700억원 소송", quotes=[other_quote]), change(), other)
    assert (
        problems_of(
            event(title="700억원 소송", changeNos=[12, 13], quotes=[other_quote]), change(), other
        )
        == []
    )


def test_fact_in_kind_is_compared_too() -> None:
    assert problems_of(event(kind="1,300억원 소송"))


def test_causal_claim_needs_cause_in_quote() -> None:
    assert problems_of(event(title="패소로 인한 지급"))
    text = "소송 패소로 인해 지급했습니다."
    allowed = event(title="패소로 인한 지급", quotes=[quote(text="패소로 인해 지급")])

    assert problems_of(allowed, change(current_text=text)) == []


def test_investment_advice_in_title_is_a_problem() -> None:
    (problem,) = problems_of(event(title="패소, 지금 매수 추천"))

    assert "투자 권유" in problem


def test_investment_advice_in_kind_is_a_problem() -> None:
    assert problems_of(event(kind="매수 추천"))


def test_investment_words_in_quote_are_source_and_not_scanned() -> None:
    text = "증권사가 매수 추천 의견을 냈습니다."

    assert (
        problems_of(event(quotes=[quote(text="매수 추천 의견")]), change(current_text=text)) == []
    )


def test_heading_change_can_be_quoted_with_short_text() -> None:
    heading = EventChange(
        12,
        CandidateChange(ADDED, PARAGRAPH, HEADING, None, False, "I. 회사의 개요"),
        None,
        7,
        None,
        "합병",
    )

    assert problems_of(event(title="합병", kind="합병", quotes=[quote(text="합병")]), heading) == []
