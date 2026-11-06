from dataclasses import replace

from app.compare.listing import LITIGATION, MAIN
from app.compare.text_diff import MODIFIED
from app.documents.parser import PARAGRAPH
from app.events.candidates import CandidateChange
from app.events.model import (
    AMOUNT,
    CAUTION,
    FRONT_KIND,
    POSITIVE,
    UNIT_COUNT,
    EventChange,
    EventScale,
    EventSignal,
    TextEvent,
)
from app.events.ordering import rank


def change(
    no: int,
    units: int = 1,
    current: str | None = "내용",
    previous: str | None = None,
) -> EventChange:
    return EventChange(
        no,
        CandidateChange(MODIFIED, PARAGRAPH, MAIN, LITIGATION, False, "XI. 그 밖에"),
        200 if previous else None,
        100,
        previous,
        current,
        units,
    )


def scale(krw: int | None = None, amount: int | None = None) -> EventScale:
    return EventScale(amount=amount if amount is not None else krw, krw=krw)


def event(
    no: int,
    krw: int | None = None,
    title: str = "사건",
    kind: str = "기타",
    amount: int | None = None,
) -> TextEvent:
    return TextEvent(title, kind, [no], [], scale(krw, amount))


def changes(*items: EventChange) -> dict[int, EventChange]:
    return {c.change_no: c for c in items}


def order(events: list[TextEvent], by_no: dict[int, EventChange]) -> list[int]:
    return [e.change_nos[0] for e in rank(events, by_no)]


def test_larger_amount_comes_first_and_basis_is_amount() -> None:
    by_no = changes(change(1), change(2), change(3))

    ranked = rank([event(1, 10), event(2, 300), event(3, 20)], by_no)

    assert [e.change_nos[0] for e in ranked] == [2, 3, 1]
    assert {e.basis for e in ranked} == {AMOUNT}


def test_litigation_is_ranked_with_other_amounts_on_same_line() -> None:
    by_no = changes(change(1), change(2))
    fine = event(1, 2_000_000)
    suit = event(2, 100_000_000, title="주주총회결의취소 소송", kind="소송")

    assert order([fine, suit], by_no) == [2, 1]


def test_event_without_amount_comes_after_event_with_amount() -> None:
    by_no = changes(change(1, units=99), change(2, units=1))

    ranked = rank([event(1), event(2, 5)], by_no)

    assert [e.change_nos[0] for e in ranked] == [2, 1]
    assert ranked[1].basis == UNIT_COUNT


def test_events_without_amount_are_ordered_by_summed_unit_count() -> None:
    by_no = changes(change(1, units=2), change(2, units=2), change(3, units=3))
    first = TextEvent("사건", "기타", [1, 2], [])
    second = TextEvent("사건", "기타", [3], [])

    assert [e.change_nos[0] for e in rank([second, first], by_no)] == [1, 3]


def test_same_unit_count_keeps_document_order() -> None:
    by_no = changes(change(1), change(2), change(3))

    assert order([event(3), event(1), event(2)], by_no) == [1, 2, 3]


def test_same_amount_uses_unit_count_then_document_order() -> None:
    by_no = changes(change(1), change(2, units=5), change(3))

    assert order([event(1, 7), event(2, 7), event(3, 7)], by_no) == [2, 1, 3]


def test_foreign_amount_without_won_value_is_on_unit_count_line() -> None:
    by_no = changes(change(1, units=9), change(2))

    ranked = rank([event(1, amount=11_800_000), event(2, 5)], by_no)

    assert [e.change_nos[0] for e in ranked] == [2, 1]
    assert ranked[1].basis == UNIT_COUNT


def front(no: int, krw: int | None = None, is_front: bool = True) -> TextEvent:
    signal = EventSignal("REHABILITATION", "OCCURRED", "새로 발생", CAUTION, front=is_front)
    return replace(event(no, krw), signal=signal)


def test_new_front_kind_comes_first_even_without_amount() -> None:
    by_no = changes(change(1), change(2))

    ranked = rank([event(2, 10**15), front(1)], by_no)

    assert [e.change_nos[0] for e in ranked] == [1, 2]
    assert ranked[0].basis == FRONT_KIND
    assert ranked[1].basis == AMOUNT


def test_front_kinds_are_ordered_by_amount_among_themselves() -> None:
    by_no = changes(change(1), change(2))

    assert order([front(1, 5), front(2, 50)], by_no) == [2, 1]


def test_signal_that_is_not_front_does_not_go_first() -> None:
    by_no = changes(change(1), change(2))

    ranked = rank([front(1, is_front=False), event(2, 5)], by_no)

    assert [e.change_nos[0] for e in ranked] == [2, 1]
    assert ranked[1].basis == UNIT_COUNT


def test_front_words_in_title_alone_do_not_make_front_kind() -> None:
    """맨 앞 종류는 낱말이 아니라 기준표 신호로 정한다(ADR-0060)."""
    by_no = changes(change(1, current="회생절차 개시를 신청했습니다"))

    (ranked,) = rank([event(1, title="회생절차 개시신청", kind="회생절차")], by_no)

    assert ranked.basis == UNIT_COUNT


def test_signal_does_not_change_order_among_amounts() -> None:
    by_no = changes(change(1), change(2))
    caution_signal = EventSignal("SANCTION", "OCCURRED", "새로 발생", CAUTION)
    positive_signal = EventSignal("MAJOR_CONTRACT", "NEW", "신규 계약", POSITIVE)
    caution = replace(event(1, 10), signal=caution_signal)
    positive = replace(event(2, 300), signal=positive_signal)

    ranked = rank([caution, positive], by_no)

    assert [e.change_nos[0] for e in ranked] == [2, 1]
    assert [e.signal.signal for e in ranked if e.signal] == [POSITIVE, CAUTION]


def test_larger_amount_goes_first_even_with_fewer_changed_units() -> None:
    by_no = changes(change(1, units=1), change(2, units=50))

    ranked = rank([event(2, krw=100), event(1, krw=900)], by_no)

    assert [e.change_nos for e in ranked] == [[1], [2]]
