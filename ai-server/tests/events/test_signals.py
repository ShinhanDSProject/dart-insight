from app.compare.listing import LITIGATION, MAIN
from app.compare.text_diff import MODIFIED
from app.documents.parser import PARAGRAPH, TABLE
from app.events.candidates import CandidateChange
from app.events.model import (
    CAUTION,
    CURRENT,
    EVIDENCE_NOT_CONFIRMED,
    HOLD,
    MIXED_LITIGATION,
    MIXED_SIDES,
    NO_CRITERIA,
    POSITIVE,
    PREVIOUS,
    EventChange,
    EventScale,
    FactAccount,
    GlossaryTerm,
    Quote,
    RowCounts,
    SignalPick,
    TextEvent,
)
from app.events.signals import (
    SignalTable,
    attach_glossary,
    attach_signals,
    kind_name,
    load_table,
    table_json,
)

CURRENT_ID = "20260814003699#B100"
PREVIOUS_ID = "20250814003156#B200"


def change(no: int = 1, rows: RowCounts | None = None) -> EventChange:
    return EventChange(
        no,
        CandidateChange(MODIFIED, TABLE if rows else PARAGRAPH, MAIN, LITIGATION, False, "XI"),
        200,
        100,
        "이전 글",
        "이번 글",
        row_counts=rows,
    )


def quote(side: str = CURRENT, no: int = 1) -> Quote:
    return Quote(no, "CHANGE", side, "글", CURRENT_ID if side == CURRENT else PREVIOUS_ID)


def event(
    kind: str | None,
    change_code: str | None,
    side: str | None = CURRENT,
    evidence_id: str | None = CURRENT_ID,
    change_nos: list[int] | None = None,
    scale: EventScale | None = None,
) -> TextEvent:
    return TextEvent(
        "제목",
        kind_name(kind),
        change_nos or [1],
        [quote(CURRENT), quote(PREVIOUS)],
        scale or EventScale(),
        pick=SignalPick(kind, change_code, side, evidence_id),
    )


def signal_of(e: TextEvent, *changes: EventChange):  # noqa: ANN201
    by_no = {c.change_no: c for c in (changes or (change(),))}
    (result,) = attach_signals([e], by_no)
    assert result.signal is not None
    return result.signal


def test_table_signal_is_attached_with_code_names_and_evidence() -> None:
    signal = signal_of(event("SANCTION", "OCCURRED"))

    assert (signal.kind_code, signal.change_code, signal.change_name) == (
        "SANCTION",
        "OCCURRED",
        "새로 발생",
    )
    assert signal.signal == CAUTION
    assert signal.hold_reason is None
    assert signal.evidence_id == CURRENT_ID


def test_same_kind_and_change_give_the_same_signal_regardless_of_scale() -> None:
    small = signal_of(event("MAJOR_CONTRACT", "NEW_SUPPLY", scale=EventScale(amount=1, krw=1)))
    large = signal_of(
        event("MAJOR_CONTRACT", "NEW_SUPPLY", scale=EventScale(amount=10**15, krw=10**15))
    )

    assert small == large
    assert small.signal == POSITIVE


def test_kind_outside_the_table_is_held_without_criteria_as_other() -> None:
    signal = signal_of(event("NOT_A_KIND", "OCCURRED"))

    assert (signal.kind_code, signal.change_code) == ("OTHER", "OTHER")
    assert (signal.signal, signal.hold_reason) == (HOLD, NO_CRITERIA)
    assert signal.evidence_id is None
    assert kind_name("NOT_A_KIND") == "그 밖의 사건"


def test_change_outside_the_kind_is_held_without_criteria() -> None:
    signal = signal_of(event("SANCTION", "WON"))

    assert (signal.kind_code, signal.change_code) == ("OTHER", "OTHER")
    assert (signal.signal, signal.hold_reason) == (HOLD, NO_CRITERIA)


def test_missing_pick_is_held_without_criteria() -> None:
    signal = signal_of(event(None, None, side=None, evidence_id=None))

    assert (signal.signal, signal.hold_reason) == (HOLD, NO_CRITERIA)


def test_evidence_that_is_not_a_quote_of_the_event_is_not_confirmed() -> None:
    signal = signal_of(event("SANCTION", "OCCURRED", evidence_id="20260814003699#B999"))

    assert (signal.signal, signal.hold_reason) == (HOLD, EVIDENCE_NOT_CONFIRMED)
    assert signal.evidence_id is None


def test_missing_evidence_is_not_confirmed() -> None:
    signal = signal_of(event("SANCTION", "OCCURRED", side=None, evidence_id=None))

    assert (signal.signal, signal.hold_reason) == (HOLD, EVIDENCE_NOT_CONFIRMED)


def test_explicit_only_change_needs_a_quote_from_the_current_report() -> None:
    """취소는 그렇다고 적은 이번 보고서 문장이 근거일 때만. 이전 글만으로는 아니다."""
    stated = signal_of(event("SANCTION", "CANCELLED"))
    only_previous = signal_of(event("SANCTION", "CANCELLED", PREVIOUS, PREVIOUS_ID))

    assert stated.signal == POSITIVE
    assert (only_previous.signal, only_previous.hold_reason) == (HOLD, EVIDENCE_NOT_CONFIRMED)


def test_change_that_is_not_explicit_only_can_use_the_previous_quote() -> None:
    signal = signal_of(event("SANCTION", "OCCURRED", PREVIOUS, PREVIOUS_ID))

    assert signal.signal == CAUTION
    assert signal.evidence_id == PREVIOUS_ID


def test_litigation_with_two_or_more_changed_rows_is_held_as_mixed() -> None:
    rows = change(1, RowCounts(changed=1, added=1, missing=0))

    signal = signal_of(event("LITIGATION", "LOST"), rows)

    assert (signal.signal, signal.hold_reason) == (HOLD, MIXED_LITIGATION)
    assert (signal.kind_code, signal.change_code) == ("LITIGATION", "LOST")


def test_rows_are_summed_over_the_tables_of_the_event() -> None:
    first = change(1, RowCounts(changed=1, added=0, missing=0))
    second = change(2, RowCounts(changed=0, added=0, missing=1))

    signal = signal_of(event("LITIGATION", "LOST", change_nos=[1, 2]), first, second)

    assert signal.hold_reason == MIXED_LITIGATION


def test_litigation_with_one_changed_row_keeps_the_table_signal() -> None:
    rows = change(1, RowCounts(changed=1, added=0, missing=0))

    assert signal_of(event("LITIGATION", "LOST"), rows).signal == CAUTION


def test_mixed_rows_do_not_hold_other_kinds() -> None:
    rows = change(1, RowCounts(changed=3, added=2, missing=1))

    assert signal_of(event("SANCTION", "OCCURRED"), rows).signal == CAUTION


def test_unconfirmed_evidence_wins_over_mixed_litigation() -> None:
    rows = change(1, RowCounts(changed=2, added=0, missing=0))

    signal = signal_of(event("LITIGATION", "LOST", evidence_id="x#B1"), rows)

    assert signal.hold_reason == EVIDENCE_NOT_CONFIRMED


def test_change_with_good_and_bad_sides_is_held_as_mixed_sides() -> None:
    signal = signal_of(event("RIGHTS_OFFERING", "DECIDED"))

    assert (signal.signal, signal.hold_reason) == (HOLD, MIXED_SIDES)
    assert signal.evidence_id == CURRENT_ID


def test_change_without_a_signal_is_held_without_criteria_but_keeps_evidence() -> None:
    signal = signal_of(event("LITIGATION", "PROGRESSED"))

    assert (signal.signal, signal.hold_reason) == (HOLD, NO_CRITERIA)
    assert signal.evidence_id == CURRENT_ID


def test_newly_occurred_front_kind_with_confirmed_evidence_is_front() -> None:
    assert signal_of(event("REHABILITATION", "OCCURRED")).front is True


def test_front_kind_with_unconfirmed_evidence_is_not_front() -> None:
    assert signal_of(event("REHABILITATION", "OCCURRED", evidence_id="x#B1")).front is False


def test_front_kind_evidenced_only_by_the_previous_report_is_not_front() -> None:
    signal = signal_of(event("REHABILITATION", "OCCURRED", PREVIOUS, PREVIOUS_ID))

    assert signal.signal == CAUTION
    assert signal.front is False


def test_resolved_front_kind_is_not_front() -> None:
    assert signal_of(event("REHABILITATION", "CONCLUDED")).front is False


def test_other_kinds_are_not_front() -> None:
    assert signal_of(event("SANCTION", "OCCURRED")).front is False


def test_fact_accounts_come_from_the_table() -> None:
    treasury = signal_of(event("TREASURY_STOCK", "RETIRED"))
    investment = signal_of(event("LARGE_INVESTMENT", "DECIDED"))
    sanction = signal_of(event("SANCTION", "OCCURRED"))

    assert treasury.fact_accounts == (FactAccount("자기주식"),)
    assert investment.fact_accounts == (
        FactAccount("유형자산", "시설 투자"),
        FactAccount("건설중인자산", "시설 투자"),
        FactAccount("관계기업투자", "지분 투자"),
    )
    assert sanction.fact_accounts == ()


def test_kind_name_is_the_table_name() -> None:
    assert kind_name("SANCTION") == "제재"
    assert kind_name(None) == "그 밖의 사건"


def test_table_json_has_the_public_shape_and_leaves_out_unconfirmed_terms() -> None:
    table = load_table()

    shown = table_json(table)

    assert shown["version"] == table.version == "signal-table-2"
    assert "투자 판단이 아니" in shown["signalNotice"]
    assert set(shown) == {"version", "signalNotice", "kinds", "glossary"}
    sanction = next(k for k in shown["kinds"] if k["code"] == "SANCTION")
    assert set(sanction) == {
        "code",
        "name",
        "front",
        "changes",
        "accounts",
        "accountsByType",
        "generalSides",
    }
    cancelled = next(c for c in sanction["changes"] if c["code"] == "CANCELLED")
    assert cancelled == {
        "code": "CANCELLED",
        "name": "취소",
        "signal": "POSITIVE",
        "explicitOnly": True,
        "general": "제재가 취소됐다고 적힌 것이라, 그 제재로 생길 부담이 없어질 수 있어요.",
    }
    paid = next(k for k in shown["kinds"] if k["code"] == "CAPITAL_REDUCTION")["changes"][1]
    assert (paid["signal"], paid["general"]) == ("MIXED", None)
    # 출처를 확인한 용어가 아직 없다(7.8)
    assert shown["glossary"] == []


def test_glossary_has_only_sourced_terms_that_appear_in_the_quotes() -> None:
    sourced = GlossaryTerm("글", "풀이", "출처")
    unsourced = GlossaryTerm("글", "풀이", None)
    absent_term = GlossaryTerm("과징금", "풀이", "출처")
    table = SignalTable("t", "안내", load_table().kinds, (sourced, unsourced, absent_term))

    (result,) = attach_glossary([event("SANCTION", "OCCURRED")], table)

    assert result.glossary == (sourced,)


def test_glossary_of_the_current_table_is_empty() -> None:
    (result,) = attach_glossary([event("SANCTION", "OCCURRED")])

    assert result.glossary == ()
