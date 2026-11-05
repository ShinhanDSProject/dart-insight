import pytest

from app.compare.listing import LITIGATION, MAIN
from app.compare.text_diff import MODIFIED
from app.documents.parser import PARAGRAPH
from app.events.candidates import CandidateChange
from app.events.model import (
    AMOUNT,
    FRONT_KIND,
    UNIT_COUNT,
    EventChange,
    EventScale,
    TextEvent,
)
from app.events.ordering import is_front_kind, rank


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


def test_new_front_kind_comes_first_even_without_amount() -> None:
    by_no = changes(change(1, current="회생절차 개시를 신청했습니다"), change(2))
    front = event(1, title="회생절차 개시신청", kind="회생")

    ranked = rank([event(2, 10**15), front], by_no)

    assert [e.change_nos[0] for e in ranked] == [1, 2]
    assert ranked[0].basis == FRONT_KIND
    assert ranked[1].basis == AMOUNT


def test_front_kinds_are_ordered_by_amount_among_themselves() -> None:
    by_no = changes(change(1, current="회생절차 개시"), change(2, current="영업정지 처분"))
    small = event(1, 5, title="회생절차 개시")
    large = event(2, 50, title="영업정지 처분")

    assert order([small, large], by_no) == [2, 1]


@pytest.mark.parametrize(
    ("title", "text"),
    [
        ("감사의견 비적정", "감사의견은 부적정입니다"),
        ("감사의견 의견거절", "감사인이 의견거절을 표명"),
        ("계속기업 불확실성 기재", "계속기업으로서의 존속능력에 중요한 불확실성이 있습니다"),
        ("회생절차 개시신청", "회생절차 개시를 신청"),
        ("영업정지 처분", "영업정지 처분을 받았습니다"),
        ("대표이사 횡령 혐의", "횡령 혐의로 기소"),
        ("임원 배임 혐의", "배임 혐의로 기소"),
        ("부도 발생", "어음 부도 발생"),
        ("해산사유 발생", "해산사유가 발생"),
        ("채권은행 관리절차 개시", "채권은행 등의 관리절차가 개시"),
    ],
)
def test_front_kind_words_are_recognized(title: str, text: str) -> None:
    assert is_front_kind(event(1, title=title), changes(change(1, current=text)))


def test_word_only_in_source_is_not_front_kind() -> None:
    by_no = changes(change(1, current="내부 규정에 횡령 금지를 적었습니다"))

    assert not is_front_kind(event(1, title="내부 규정 개정"), by_no)


def test_word_only_in_title_is_not_front_kind() -> None:
    assert not is_front_kind(event(1, title="횡령 혐의"), changes(change(1, current="내용")))


def test_word_already_in_previous_text_is_not_new() -> None:
    by_no = changes(change(1, current="횡령 혐의 재판 중", previous="횡령 혐의로 기소"))

    assert not is_front_kind(event(1, title="횡령 혐의"), by_no)


def test_word_in_kind_counts() -> None:
    assert is_front_kind(event(1, kind="횡령"), changes(change(1, current="횡령 혐의로 기소")))


def test_larger_amount_goes_first_even_with_fewer_changed_units() -> None:
    by_no = changes(change(1, units=1), change(2, units=50))

    ranked = rank([event(2, krw=100), event(1, krw=900)], by_no)

    assert [e.change_nos for e in ranked] == [[1], [2]]
