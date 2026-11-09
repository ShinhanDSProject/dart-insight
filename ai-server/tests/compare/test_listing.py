import pytest

from app.compare.listing import (
    AUDIT,
    BOARD,
    BUSINESS,
    COMPARED,
    CONSOLIDATED,
    CONTRACT,
    DIVIDEND,
    FORMATTING,
    FUNDING,
    GROUP_MOVED,
    HEADING,
    LITIGATION,
    MAIN,
    NOT_COMPARED,
    NOTE,
    OTHER,
    PAIRED_TABLE,
    PERIOD,
    SEPARATE,
    SHAREHOLDER,
    UNKNOWN,
    UNPAIRED,
    CellChange,
    ChangedRow,
    RowCounts,
    classify,
    compare_table_rows,
    field_for_path,
    list_entries,
    missing_fields,
)
from app.compare.period import PeriodShift
from app.compare.text_diff import (
    ADDED,
    DELETED,
    MODIFIED,
    MOVED,
    NUMERIC_UPDATE,
    REVIEW_NEEDED,
    Change,
    DocumentIn,
    Position,
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


@pytest.mark.parametrize(
    ("previous", "current"),
    [
        ("영업손실 △1,000", "영업손실 1,000"),
        ("가격 ▲50", "가격 ▼50"),
        ("신용등급 BBB+", "신용등급 BBB-"),
        ("금액 $100", "금액 ₩100"),
        ("비율 100%", "비율 100"),
        ("해당 여부 ○", "해당 여부 ×"),
        ("구분 | 100 | | 200", "구분 | | 100 | 200"),
    ],
)
def test_modified_with_a_meaningful_symbol_stays_in_main(previous: str, current: str) -> None:
    assert classify(change(MODIFIED), previous, current).group == MAIN


def test_changed_list_number_style_is_formatting() -> None:
    assert (
        classify(change(MODIFIED), "(1) 개인별 보수지급금액", "1. 개인별 보수지급금액").group
        == FORMATTING
    )


def test_added_bullet_hyphen_is_formatting() -> None:
    previous, current = "법인의 대표이사 변동내역", "- 법인의 대표이사 변동내역"
    assert classify(change(MODIFIED), previous, current).group == FORMATTING


def test_changed_numbering_with_a_hyphen_is_formatting() -> None:
    assert classify(change(MODIFIED), "(2-1) 이사 전체", "2-1. 이사 전체").group == FORMATTING


def test_numeric_update_stays_in_main() -> None:
    entry = classify(change(NUMERIC_UPDATE), "매출 100억원", "매출 120억원")
    assert (entry.group, entry.field) == (MAIN, BUSINESS)


YEARLY = PeriodShift(
    1, 1, frozenset({((2025, 6, 30), (2026, 6, 30))}), frozenset({(1, 1), (6, 30), (12, 31)})
)


@pytest.mark.parametrize("kind", [NUMERIC_UPDATE, MODIFIED])
def test_text_with_only_a_shifted_period_is_period(kind: str) -> None:
    entry = classify(
        change(kind), "2025년(제57기) 반기 실적입니다.", "2026년(제58기) 반기 실적입니다.", YEARLY
    )
    assert (entry.group, entry.field) == (PERIOD, None)


def test_period_is_not_folded_without_a_period_shift() -> None:
    entry = classify(change(NUMERIC_UPDATE), "(제 57 기)", "(제 58 기)")
    assert entry.group == MAIN


def test_period_with_another_changed_number_stays_in_main() -> None:
    entry = classify(
        change(NUMERIC_UPDATE), "2025년 반기 생산 100대", "2026년 반기 생산 120대", YEARLY
    )
    assert entry.group == MAIN


def test_period_only_note_stays_in_the_note_group() -> None:
    entry = classify(
        change(MODIFIED, NOTE_PATH),
        "2025년 6월 30일 현재 담보",
        "2026년 6월 30일 현재 담보",
        YEARLY,
    )
    assert (entry.group, entry.raised_from_note) == (NOTE, False)


def test_list_entries_pass_the_period_shift_to_each_change() -> None:
    changes = [
        Change(
            NUMERIC_UPDATE,
            "PARAGRAPH",
            "MATCHED",
            "개요",
            BUSINESS_PATH,
            Position(1, 1),
            Position(1, 1),
        ),
    ]
    entries = list_entries(changes, {1: "(제 57 기)"}, {1: "(제 58 기)"}, YEARLY)
    assert [e.group for e in entries] == [PERIOD]


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


def test_short_table_with_one_line_is_heading() -> None:
    entry = classify(change(ADDED, block="TABLE"), None, " | (단위 : 백만원)")
    assert entry.group == HEADING


def test_short_table_with_several_rows_stays_in_main() -> None:
    entry = classify(
        change(ADDED, block="TABLE"),
        None,
        "변동일 | 변동 전 | 변동 후\n2025.03.14 | ㈜영풍 | (유)와이피씨",
    )
    assert (entry.group, entry.field) == (MAIN, BUSINESS)


def test_short_table_with_one_row_of_values_is_heading() -> None:
    entry = classify(change(ADDED, block="TABLE"), None, " | \n | (단위 : 백만원)")
    assert entry.group == HEADING


def test_short_paragraph_with_a_line_break_is_heading() -> None:
    assert classify(change(ADDED), None, "(2)\n손상차손").group == HEADING


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


def test_note_with_only_unsecured_is_not_raised() -> None:
    entry = classify(
        change(ADDED, NOTE_PATH), None, "당사는 무담보사채를 발행하였으며 만기는 3년입니다."
    )
    assert (entry.group, entry.raised_from_note) == (NOTE, False)


def test_note_with_unsecured_and_collateral_is_raised() -> None:
    entry = classify(
        change(ADDED, NOTE_PATH), None, "무담보사채와 별도로 토지를 담보로 제공하고 있습니다."
    )
    assert (entry.group, entry.field) == (MAIN, FUNDING)


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


LAWSUIT_PATH = "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항"
PREVIOUS = (
    "소제기일 | 사건번호 | 진행상황\n"
    "2025.01.10 | 2025가합1 | 진행 중\n"
    "2025.01.10 | 2025가합2 | 진행 중\n"
    "2025.02.01 | 2025가합3 | 진행 중"
)
CURRENT = (
    "소제기일 | 사건번호 | 진행상황\n"
    "2025.01.10 | 2025가합1 | 화해권고결정\n"
    "2025.02.01 | 2025가합3 | 진행 중\n"
    "2026.03.05 | 2026가합9 | 진행 중"
)


def test_rows_are_split_into_changed_added_missing_and_same() -> None:
    diff = compare_table_rows(PREVIOUS, CURRENT)
    assert diff.status == COMPARED
    assert diff.key_column == "사건번호"
    assert diff.counts == RowCounts(changed=1, added=1, missing=1, same=1)
    assert diff.added_keys == ["2026가합9"]
    assert diff.missing_keys == ["2025가합2"]


def test_changed_row_lists_only_the_changed_cells() -> None:
    diff = compare_table_rows(PREVIOUS, CURRENT)
    assert diff.changed_rows == [
        ChangedRow("2025가합1", [CellChange("진행상황", "진행 중", "화해권고결정")])
    ]


def test_column_with_repeated_values_is_not_the_key() -> None:
    assert compare_table_rows(PREVIOUS, CURRENT).key_column != "소제기일"


def test_key_is_the_column_with_the_most_shared_values() -> None:
    previous = "이름 | 번호\n가 | a1\n나 | a2\n다 | a3"
    current = "이름 | 번호\n가 | a1\n라 | a2\n마 | a9"
    assert compare_table_rows(previous, current).key_column == "번호"


def test_tie_goes_to_the_earlier_column() -> None:
    previous = "이름 | 코드\n가 | a\n나 | b"
    current = "이름 | 코드\n가 | a\n다 | c"
    assert compare_table_rows(previous, current).key_column == "이름"


def test_columns_only_in_one_table_are_ignored() -> None:
    previous = "번호 | 없어진 열 | 값\nA1 | p | 10\nA2 | q | 20"
    current = "번호 | 값 | 새 열\nA1 | 10 | r\nA2 | 25 | s"
    diff = compare_table_rows(previous, current)
    assert diff.counts == RowCounts(changed=1, added=0, missing=0, same=1)
    assert diff.changed_rows == [ChangedRow("A2", [CellChange("값", "20", "25")])]


def test_spacing_alone_is_not_a_changed_cell() -> None:
    previous = "번호 | 값\nA1 | 진행 중\nA2 | 끝"
    current = "번호 | 값\nA1 | 진행중\nA2 | 끝"
    assert compare_table_rows(previous, current).counts.same == 2


def test_key_column_named_with_different_spacing_is_the_same_column() -> None:
    diff = compare_table_rows("구 분 | 값\n가 | 1\n나 | 2", "구분 | 값\n가 | 1\n나 | 3")
    assert diff.key_column == "구 분"
    assert diff.counts == RowCounts(changed=1, added=0, missing=0, same=1)


def test_changed_cell_under_a_column_with_different_spacing_is_not_lost() -> None:
    diff = compare_table_rows("코드 | 구 분\na | 진행\nb | 끝", "코드 | 구분\na | 끝\nb | 끝")
    assert diff.changed_rows == [ChangedRow("a", [CellChange("구 분", "진행", "끝")])]


def test_table_with_columns_that_differ_only_by_spacing_is_not_compared() -> None:
    assert_not_compared(
        "구 분 | 구분 | 코드\n가 | 나 | a\n다 | 라 | b",
        "구 분 | 구분 | 코드\n가 | 마 | a\n다 | 라 | b",
    )


def test_table_with_an_unnamed_column_is_not_compared() -> None:
    assert_not_compared(
        "코드 |  | 값\na | 나 | x\nb | 라 | y", "코드 |  | 값\na | 마 | x\nb | 라 | y"
    )


def test_table_with_a_column_named_twice_is_not_compared_despite_a_key() -> None:
    assert_not_compared(
        "코드 | 값 | 값\na | 1 | 2\nb | 3 | 4", "코드 | 값 | 값\na | 1 | 9\nb | 3 | 4"
    )


def test_spacing_alone_does_not_break_the_key() -> None:
    previous = "이름 | 값\n서울 지점 | 1\n부산 | 2"
    current = "이름 | 값\n서울지점 | 1\n부산 | 2"
    assert compare_table_rows(previous, current).counts == RowCounts(0, 0, 0, 2)


def assert_not_compared(previous: str, current: str) -> None:
    diff = compare_table_rows(previous, current)
    assert diff.status == NOT_COMPARED
    assert (diff.key_column, diff.counts, diff.paired_previous) == (None, None, None)
    assert (diff.changed_rows, diff.added_keys, diff.missing_keys) == ([], [], [])


def test_table_whose_columns_all_repeat_is_not_compared() -> None:
    assert_not_compared("구분 | 값\n가 | 1\n가 | 1", "구분 | 값\n가 | 2\n가 | 2")


def test_column_with_an_empty_value_is_not_a_key() -> None:
    assert_not_compared("구분 | 값\n | 1\n가 | 1", "구분 | 값\n | 2\n가 | 2")


def test_table_with_a_row_of_different_length_is_not_compared() -> None:
    assert_not_compared("구분 | 값\n가 | 1\n나", "구분 | 값\n가 | 1\n나 | 2")


def test_table_without_a_shared_value_is_not_compared() -> None:
    assert_not_compared("구분 | 값\n가 | 1\n나 | 2", "구분 | 값\n다 | 3\n라 | 4")


def test_column_of_amounts_is_not_a_key() -> None:
    assert_not_compared(
        "구분 | 금액\n가 | 1,000\n가 | (200)", "구분 | 금액\n가 | 1,000\n가 | 30.5%"
    )


def test_column_with_a_placeholder_is_not_a_key() -> None:
    assert_not_compared("일자 | 값\n- | x\n2025.01.01 | x", "일자 | 값\n- | y\n2025.01.01 | y")


def test_column_of_dates_can_be_a_key() -> None:
    previous = "일자 | 값\n2025.01.01 | 1\n2025.02.01 | 1"
    current = "일자 | 값\n2025.01.01 | 2\n2025.03.01 | 1"
    diff = compare_table_rows(previous, current)
    assert diff.key_column == "일자"
    assert diff.counts == RowCounts(changed=1, added=1, missing=1, same=0)


def test_table_without_a_common_column_is_not_compared() -> None:
    assert_not_compared("구분 | 값\n가 | 1", "항목 | 금액\n가 | 1")


def test_table_with_only_a_header_is_not_compared() -> None:
    assert_not_compared("구분 | 값", "구분 | 값\n가 | 1")


def test_column_named_twice_is_not_a_key() -> None:
    assert_not_compared("값 | 값\nA1 | 2\nA3 | 4", "값 | 값\nA1 | 2\nA3 | 5")


def block_change(
    kind: str, previous_no: int | None, current_no: int | None, path: str = LAWSUIT_PATH
) -> Change:
    previous = Position(1, previous_no) if previous_no is not None else None
    current = Position(1, current_no) if current_no is not None else None
    return Change(kind, "TABLE", "MATCHED", path.split(" > ")[-1], path, previous, current)


def test_deleted_and_added_tables_are_paired_and_the_deleted_one_folded() -> None:
    changes = [block_change(DELETED, 5, None), block_change(ADDED, None, 7)]
    deleted, added = list_entries(changes, {5: PREVIOUS}, {7: CURRENT})
    assert (deleted.group, deleted.field, deleted.row_diff) == (PAIRED_TABLE, None, None)
    assert added.group == MAIN
    assert added.row_diff.status == COMPARED
    assert added.row_diff.counts == RowCounts(changed=1, added=1, missing=1, same=1)
    assert added.row_diff.paired_previous == Position(1, 5)


def test_tables_with_different_headers_are_not_paired() -> None:
    changes = [block_change(DELETED, 5, None), block_change(ADDED, None, 7)]
    current = CURRENT.replace("진행상황", "진행 상태")
    deleted, added = list_entries(changes, {5: PREVIOUS}, {7: current})
    assert deleted.group == MAIN
    assert (deleted.row_diff, added.row_diff) == (None, None)


def test_tables_in_different_sections_are_not_paired() -> None:
    changes = [
        block_change(DELETED, 5, None),
        block_change(ADDED, None, 7, "VII. 주주에 관한 사항"),
    ]
    deleted, added = list_entries(changes, {5: PREVIOUS}, {7: CURRENT})
    assert deleted.group == MAIN
    assert added.row_diff is None


def test_tables_without_a_key_are_not_paired() -> None:
    changes = [block_change(DELETED, 5, None), block_change(ADDED, None, 7)]
    previous, current = "구분 | 값\n가 | 1\n가 | 1", "구분 | 값\n가 | 2\n가 | 2"
    deleted, added = list_entries(changes, {5: previous}, {7: current})
    assert deleted.group == MAIN
    assert added.row_diff is None


def test_pair_with_the_most_shared_values_is_chosen_first() -> None:
    first = "번호 | 값\nA1 | 가\nA2 | 나\nA3 | 다"
    second = "번호 | 값\nA4 | 가\nA5 | 나\nA6 | 다"
    changes = [
        block_change(DELETED, 1, None),
        block_change(DELETED, 2, None),
        block_change(ADDED, None, 3),
        block_change(ADDED, None, 4),
    ]
    entries = list_entries(
        changes,
        {1: first, 2: second},
        {3: "번호 | 값\nA4 | x\nA5 | 나\nA6 | 다", 4: "번호 | 값\nA1 | x\nA9 | 나\nA8 | 다"},
    )
    assert entries[2].row_diff.paired_previous == Position(1, 2)
    assert entries[3].row_diff.paired_previous == Position(1, 1)


def test_tie_goes_to_the_earlier_tables_in_document_order() -> None:
    table = "번호 | 값\nA1 | 가\nA2 | 나"
    changes = [
        block_change(DELETED, 2, None),
        block_change(DELETED, 1, None),
        block_change(ADDED, None, 4),
        block_change(ADDED, None, 3),
    ]
    entries = list_entries(changes, {1: table, 2: table}, {3: table, 4: table})
    by_current = {c.current.block_no: e for c, e in zip(changes, entries, strict=True) if c.current}
    assert by_current[3].row_diff.paired_previous == Position(1, 1)
    assert by_current[4].row_diff.paired_previous == Position(1, 2)


def test_a_table_joins_only_one_pair() -> None:
    table = "번호 | 값\nA1 | 가\nA2 | 나"
    changes = [
        block_change(DELETED, 1, None),
        block_change(DELETED, 2, None),
        block_change(ADDED, None, 3),
    ]
    entries = list_entries(changes, {1: table, 2: table}, {3: table})
    assert [e.group for e in entries[:2]] == [PAIRED_TABLE, MAIN]
    assert entries[2].row_diff.paired_previous == Position(1, 1)


def test_paired_note_table_stays_a_note_with_its_comparison() -> None:
    changes = [
        block_change(DELETED, 5, None, NOTE_PATH),
        block_change(ADDED, None, 7, NOTE_PATH),
    ]
    previous = "번호 | 값\nA1 | 가나다라마바사\nA2 | 나"
    current = "번호 | 값\nA1 | 가나다라마바사\nA2 | 다"
    deleted, added = list_entries(changes, {5: previous}, {7: current})
    assert (deleted.group, deleted.note_scope) == (PAIRED_TABLE, "CONSOLIDATED")
    assert added.group == NOTE
    assert added.row_diff.counts == RowCounts(changed=1, added=0, missing=0, same=1)


def test_modified_table_is_compared_without_a_paired_previous() -> None:
    changes = [block_change(MODIFIED, 5, 7)]
    [entry] = list_entries(changes, {5: PREVIOUS}, {7: CURRENT})
    assert entry.row_diff.status == COMPARED
    assert entry.row_diff.paired_previous is None


def test_numeric_update_table_is_compared() -> None:
    changes = [block_change(NUMERIC_UPDATE, 5, 7)]
    previous, current = "구분 | 값\n가 | 1\n나 | 2", "구분 | 값\n가 | 1\n나 | 3"
    [entry] = list_entries(changes, {5: previous}, {7: current})
    assert entry.row_diff.changed_rows == [ChangedRow("나", [CellChange("값", "2", "3")])]


def test_moved_table_is_compared() -> None:
    table = "구분 | 값\n가 | 1\n나 | 2"
    [entry] = list_entries([block_change(MOVED, 5, 7)], {5: table}, {7: table})
    assert entry.row_diff.counts == RowCounts(changed=0, added=0, missing=0, same=2)


def test_modified_table_without_a_key_says_not_compared() -> None:
    previous, current = "구분 | 값\n가 | 1\n가 | 1", "구분 | 값\n가 | 2\n가 | 2"
    [entry] = list_entries([block_change(MODIFIED, 5, 7)], {5: previous}, {7: current})
    assert entry.row_diff.status == NOT_COMPARED


def test_paragraph_has_no_row_comparison() -> None:
    change = Change(
        MODIFIED, "PARAGRAPH", "MATCHED", "t", LAWSUIT_PATH, Position(1, 5), Position(1, 7)
    )
    [entry] = list_entries([change], {5: "가나다"}, {7: "가나라"})
    assert entry.row_diff is None


def test_added_table_without_a_partner_has_no_row_comparison() -> None:
    [entry] = list_entries([block_change(ADDED, None, 7)], {}, {7: CURRENT})
    assert entry.row_diff is None
