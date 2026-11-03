import pytest

from app.compare.listing import (
    AUDIT,
    BOARD,
    BUSINESS,
    CONSOLIDATED,
    CONTRACT,
    DIVIDEND,
    FORMATTING,
    FUNDING,
    GROUP_MOVED,
    HEADING,
    LITIGATION,
    MAIN,
    NOTE,
    OTHER,
    SEPARATE,
    SHAREHOLDER,
    UNKNOWN,
    UNPAIRED,
    classify,
    field_for_path,
    missing_fields,
)
from app.compare.text_diff import (
    ADDED,
    DELETED,
    MODIFIED,
    MOVED,
    NUMERIC_UPDATE,
    REVIEW_NEEDED,
    Change,
    DocumentIn,
    SectionIn,
)

BUSINESS_PATH = "II. 사업의 내용 > 1. 사업의 개요"
NOTE_PATH = "III. 재무에 관한 사항 > 3. 연결재무제표 주석"
SEPARATE_NOTE_PATH = "III. 재무에 관한 사항 > 5. 재무제표 주석"
LONG_TEXT = "당사는 메모리 반도체와 파운드리 사업을 영위하고 있습니다."


def change(kind: str, path: str = BUSINESS_PATH, block: str = "PARAGRAPH") -> Change:
    return Change(kind, block, "MATCHED", path.split(" > ")[-1], path, None, None)


def test_review_needed_is_unpaired_without_a_field() -> None:
    entry = classify(change(REVIEW_NEEDED, block="SECTION"), None, None)
    assert (entry.group, entry.field) == (UNPAIRED, None)


def test_moved_text_is_folded() -> None:
    entry = classify(change(MOVED), LONG_TEXT, LONG_TEXT)
    assert (entry.group, entry.field) == (GROUP_MOVED, None)


def test_moved_note_stays_in_moved_group() -> None:
    assert classify(change(MOVED, NOTE_PATH), LONG_TEXT, LONG_TEXT).group == GROUP_MOVED


def test_modified_with_only_spacing_and_symbols_is_formatting() -> None:
    entry = classify(
        change(MODIFIED), "당사는 반도체, 사업을 합니다.", "당사는 반도체 사업을 합니다"
    )
    assert (entry.group, entry.field) == (FORMATTING, None)


def test_modified_with_a_changed_word_stays_in_main() -> None:
    entry = classify(change(MODIFIED), "당사는 반도체 사업을 합니다.", "당사는 전지 사업을 합니다.")
    assert (entry.group, entry.field) == (MAIN, BUSINESS)


def test_modified_with_a_changed_digit_is_not_formatting() -> None:
    assert classify(change(MODIFIED), "직원 100명 (정규직)", "직원 120명 정규직").group == MAIN


def test_numeric_update_stays_in_main() -> None:
    entry = classify(change(NUMERIC_UPDATE), "매출 100억원", "매출 120억원")
    assert (entry.group, entry.field) == (MAIN, BUSINESS)


@pytest.mark.parametrize("kind", [ADDED, DELETED])
def test_short_added_or_deleted_text_is_heading(kind: str) -> None:
    text = "(2) 손상차손"
    previous, current = (None, text) if kind == ADDED else (text, None)
    entry = classify(change(kind), previous, current)
    assert (entry.group, entry.field) == (HEADING, None)


def test_text_with_nineteen_letters_is_heading() -> None:
    assert classify(change(ADDED), None, "가" * 19).group == HEADING


def test_text_with_twenty_letters_stays_in_main() -> None:
    assert classify(change(ADDED), None, "가" * 20).group == MAIN


def test_digits_and_symbols_do_not_count_as_letters() -> None:
    assert classify(change(ADDED), None, "가" * 19 + " 1,234 (%)").group == HEADING


def test_short_modified_text_is_not_heading() -> None:
    assert classify(change(MODIFIED), "소송 없음", "소송 있음").group == MAIN


def test_plain_note_is_folded_with_its_scope() -> None:
    entry = classify(change(ADDED, NOTE_PATH), None, LONG_TEXT)
    assert (entry.group, entry.field, entry.raised_from_note) == (NOTE, None, False)
    assert entry.note_scope == CONSOLIDATED


def test_separate_note_has_separate_scope() -> None:
    entry = classify(change(ADDED, SEPARATE_NOTE_PATH), None, LONG_TEXT)
    assert (entry.group, entry.note_scope) == (NOTE, SEPARATE)


def test_other_note_section_has_unknown_scope() -> None:
    entry = classify(change(ADDED, "III. 재무에 관한 사항 > 주석"), None, LONG_TEXT)
    assert (entry.group, entry.note_scope) == (NOTE, UNKNOWN)


@pytest.mark.parametrize(
    ("text", "field"),
    [
        ("계류 중인 소송이 3건 있으며 결과를 예측할 수 없습니다.", LITIGATION),
        ("당기말 현재 우발부채로 인식한 금액은 다음과 같습니다.", LITIGATION),
        ("차입금에 대하여 토지를 담보로 제공하고 있습니다.", FUNDING),
        ("종속회사의 차입금에 채무보증을 제공하고 있습니다.", FUNDING),
        ("보고기간 후 사건으로 유상증자를 결의하였습니다.", OTHER),
        ("보고기간후 사건으로 유상증자를 결의하였습니다.", OTHER),
    ],
)
def test_note_with_exception_words_is_raised_to_its_field(text: str, field: str) -> None:
    entry = classify(change(ADDED, NOTE_PATH), None, text)
    assert (entry.group, entry.field, entry.raised_from_note) == (MAIN, field, True)
    assert entry.note_scope == CONSOLIDATED


def test_note_section_title_can_raise_the_change() -> None:
    path = f"{NOTE_PATH} > 30. 우발부채와 약정사항"
    entry = classify(change(ADDED, path), None, LONG_TEXT)
    assert (entry.group, entry.field) == (MAIN, LITIGATION)


def test_litigation_wins_when_a_note_has_several_exception_words() -> None:
    entry = classify(
        change(ADDED, NOTE_PATH), None, "소송 관련하여 토지를 담보로 제공하고 있습니다."
    )
    assert entry.field == LITIGATION


def test_numeric_update_in_a_note_is_not_raised() -> None:
    entry = classify(change(NUMERIC_UPDATE, NOTE_PATH), "소송 3건", "소송 4건")
    assert (entry.group, entry.raised_from_note) == (NOTE, False)


def test_formatting_only_note_is_not_raised() -> None:
    entry = classify(change(MODIFIED, NOTE_PATH), "소송이 있습니다.", "소송이 있습니다")
    assert (entry.group, entry.raised_from_note) == (NOTE, False)


def test_short_note_is_not_raised() -> None:
    entry = classify(change(ADDED, NOTE_PATH), None, "(1) 소송")
    assert (entry.group, entry.raised_from_note) == (NOTE, False)


def test_text_outside_notes_has_no_note_values() -> None:
    entry = classify(change(ADDED), None, LONG_TEXT)
    assert (entry.raised_from_note, entry.note_scope) == (False, None)


@pytest.mark.parametrize(
    ("path", "field"),
    [
        ("XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항", LITIGATION),
        ("XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 3. 제재 등과 관련된 사항", LITIGATION),
        ("II. 사업의 내용 > 6. 주요계약 및 연구개발활동", CONTRACT),
        ("II. 사업의 내용 > 7. 기타 참고사항", BUSINESS),
        ("IV. 이사의 경영진단 및 분석의견", BUSINESS),
        ("IX. 계열회사 등에 관한 사항", BUSINESS),
        ("III. 재무에 관한 사항 > 6. 배당에 관한 사항", DIVIDEND),
        ("I. 회사의 개요 > 5. 배당에 관한 사항", DIVIDEND),
        ("III. 재무에 관한 사항 > 7. 증권의 발행을 통한 자금조달에 관한 사항", FUNDING),
        ("VI. 이사회 등 회사의 기관에 관한 사항", BOARD),
        ("VIII. 임원 및 직원 등에 관한 사항", BOARD),
        ("VII. 주주에 관한 사항", SHAREHOLDER),
        ("X. 대주주 등과의 거래내용", SHAREHOLDER),
        ("I. 회사의 개요 > 4. 주식의 총수 등", SHAREHOLDER),
        ("V. 회계감사인의 감사의견 등", AUDIT),
        ("I. 회사의 개요 > 1. 회사의 개요", OTHER),
        ("III. 재무에 관한 사항 > 1. 요약재무정보", OTHER),
        ("XII. 상세표", OTHER),
        ("(목차 밖 본문)", OTHER),
    ],
)
def test_field_comes_from_the_section_path(path: str, field: str) -> None:
    assert field_for_path(path) == field


def test_funding_outside_the_financial_section_is_not_funding() -> None:
    assert field_for_path("I. 회사의 개요 > 자금조달 계획") == OTHER


def document(rcept: str, titles: list[tuple[int, int | None, str]]) -> DocumentIn:
    sections = [
        SectionIn(no, parent, 1 if parent is None else 2, title) for no, parent, title in titles
    ]
    return DocumentIn(rcept, sections, [])


def test_missing_fields_lists_fields_absent_from_both_reports() -> None:
    previous = document(
        "20250311000001", [(1, None, "II. 사업의 내용"), (2, None, "V. 회계감사인의 감사의견 등")]
    )
    current = document("20260310000001", [(1, None, "VII. 주주에 관한 사항")])
    assert missing_fields(previous, current) == [LITIGATION, CONTRACT, DIVIDEND, FUNDING, BOARD]


def test_a_field_found_only_under_a_parent_section_is_not_missing() -> None:
    previous = document("20250311000001", [])
    current = document(
        "20260310000001",
        [(1, None, "II. 사업의 내용"), (2, 1, "6. 주요계약 및 연구개발활동")],
    )
    assert CONTRACT not in missing_fields(previous, current)


def test_other_is_never_missing() -> None:
    empty = document("20250311000001", [])
    assert OTHER not in missing_fields(empty, empty)
