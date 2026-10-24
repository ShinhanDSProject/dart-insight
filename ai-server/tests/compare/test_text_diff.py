from app.compare.text_diff import (
    ADDED,
    AMBIGUOUS,
    DELETED,
    MATCHED,
    MODIFIED,
    MOVED,
    MOVED_MIN_CHARS,
    MOVED_SIMILAR,
    NUMERIC_UPDATE,
    RENAMED,
    REVIEW_NEEDED,
    BlockIn,
    DocumentIn,
    SectionIn,
    diff_documents,
    formatting_only_differs,
    mask_numbers,
    title_key,
)

PREV = "20250311000001"
CUR = "20260310000001"


def doc(rcept: str, sections: list[tuple], blocks: list[tuple]) -> DocumentIn:
    """sections: (번호, 상위, 깊이, 제목) / blocks: (블록 번호, 섹션 번호, 종류, 글)"""
    return DocumentIn(
        rcept,
        [SectionIn(no, parent, level, title) for no, parent, level, title in sections],
        [BlockIn(no, sec, kind, text) for no, sec, kind, text in blocks],
    )


BASE_SECTIONS = [
    (1, None, 1, "I. 회사의 개요"),
    (2, None, 1, "II. 사업의 내용"),
    (3, 2, 2, "1. 사업의 개요"),
    (4, 2, 2, "2. 주요 제품"),
]


def test_title_key_drops_numbering_and_spaces() -> None:
    assert title_key("II. 사업의 내용") == "사업의내용"
    assert title_key("1. 사업의 개요") == "사업의개요"
    assert title_key("(1) 위험관리") == "위험관리"
    assert title_key("가. 주요 계약") == "주요계약"
    assert title_key("Ⅳ. 이사의 경영진단 및 분석의견") == "이사의경영진단및분석의견"


def test_numbers_are_masked_for_alignment() -> None:
    assert mask_numbers("매출 1,000 백만원 (12.5%)") == "매출 # 백만원 (#%)"


def test_same_documents_have_no_changes() -> None:
    blocks = [(1, 1, "PARAGRAPH", "회사 소개"), (2, 3, "PARAGRAPH", "반도체를 만듭니다.")]
    result = diff_documents(doc(PREV, BASE_SECTIONS, blocks), doc(CUR, BASE_SECTIONS, blocks))

    assert result.changes == []
    assert result.section_counts["matched"] == 4


def test_added_deleted_and_modified_paragraphs_keep_positions() -> None:
    prev = doc(
        PREV,
        BASE_SECTIONS,
        [
            (1, 3, "PARAGRAPH", "당사는 메모리 반도체를 만듭니다."),
            (2, 3, "PARAGRAPH", "주요 고객은 국내 기업입니다."),
            (3, 3, "PARAGRAPH", "공장은 화성에 있습니다."),
        ],
    )
    cur = doc(
        CUR,
        BASE_SECTIONS,
        [
            (11, 3, "PARAGRAPH", "당사는 메모리 반도체와 파운드리 사업을 합니다."),
            (12, 3, "PARAGRAPH", "공장은 화성에 있습니다."),
            (13, 3, "PARAGRAPH", "미국 공장을 새로 짓기 시작했습니다."),
        ],
    )

    changes = diff_documents(prev, cur).changes

    summary = [
        (c.change_type, c.previous and c.previous.block_no, c.current and c.current.block_no)
        for c in changes
    ]
    assert summary == [(MODIFIED, 1, 11), (DELETED, 2, None), (ADDED, None, 13)]
    modified = changes[0]
    assert modified.section_status == MATCHED
    assert modified.section_path == "II. 사업의 내용 > 1. 사업의 개요"
    assert modified.previous is not None and modified.previous.section_no == 3
    assert modified.similarity is not None and 0.5 <= modified.similarity < 1
    assert not modified.numbers_only


def test_table_with_only_new_numbers_is_numeric_update() -> None:
    prev = doc(PREV, BASE_SECTIONS, [(1, 4, "TABLE", "제품 | 매출\nDRAM | 1,000")])
    cur = doc(CUR, BASE_SECTIONS, [(9, 4, "TABLE", "제품 | 매출\nDRAM | 1,250")])

    (change,) = diff_documents(prev, cur).changes

    assert change.change_type == NUMERIC_UPDATE
    assert change.block_type == "TABLE"
    assert change.numbers_only
    assert change.previous_section_path is None


def test_real_edit_is_still_modified_without_numbers_only() -> None:
    prev = doc(PREV, BASE_SECTIONS, [(1, 4, "PARAGRAPH", "주요 제품은 DRAM 10종입니다.")])
    cur = doc(CUR, BASE_SECTIONS, [(1, 4, "PARAGRAPH", "주요 제품은 DRAM과 NAND 12종입니다.")])

    (change,) = diff_documents(prev, cur).changes

    assert change.change_type == MODIFIED
    assert not change.numbers_only


def test_renamed_section_is_matched_by_similar_title() -> None:
    prev_sections = [*BASE_SECTIONS, (5, 2, 2, "3. 원재료 및 생산설비")]
    cur_sections = [*BASE_SECTIONS, (5, 2, 2, "3. 원재료 및 생산 설비 현황")]
    prev = doc(PREV, prev_sections, [(1, 5, "PARAGRAPH", "원재료는 실리콘입니다.")])
    cur = doc(CUR, cur_sections, [(1, 5, "PARAGRAPH", "원재료는 실리콘 웨이퍼입니다.")])

    (change,) = diff_documents(prev, cur).changes

    assert change.change_type == MODIFIED
    assert change.section_status == RENAMED


def test_section_only_in_one_report_is_added_or_deleted_block_by_block() -> None:
    prev = doc(
        PREV,
        [*BASE_SECTIONS, (5, 2, 2, "3. 중단된 사업")],
        [(1, 5, "PARAGRAPH", "LCD 사업을 정리했습니다."), (2, 5, "TABLE", "구분 | 금액")],
    )
    cur = doc(
        CUR,
        [*BASE_SECTIONS, (5, 2, 2, "3. 신규 사업")],
        [(1, 5, "PARAGRAPH", "로봇 사업을 시작했습니다.")],
    )

    changes = diff_documents(prev, cur).changes

    # 빠진 섹션은 이전 보고서에서 있던 자리(앞 섹션 '2. 주요 제품' 뒤)에 둔다
    assert [(c.change_type, c.section_status, c.block_type) for c in changes] == [
        (DELETED, "DELETED", "PARAGRAPH"),
        (DELETED, "DELETED", "TABLE"),
        (ADDED, "ADDED", "PARAGRAPH"),
    ]
    assert changes[0].section_path == "II. 사업의 내용 > 3. 중단된 사업"


def test_duplicate_titles_with_different_counts_need_review() -> None:
    prev_sections = [*BASE_SECTIONS, (5, 4, 3, "가. 기타"), (6, 4, 3, "가. 기타")]
    cur_sections = [*BASE_SECTIONS, (5, 4, 3, "가. 기타")]
    prev = doc(PREV, prev_sections, [(1, 5, "PARAGRAPH", "a"), (2, 6, "PARAGRAPH", "b")])
    cur = doc(CUR, cur_sections, [(1, 5, "PARAGRAPH", "a")])

    changes = diff_documents(prev, cur).changes

    assert {c.change_type for c in changes} == {REVIEW_NEEDED}
    assert len(changes) == 3  # 짝을 정하지 못한 섹션마다 하나(현재 1 + 이전 2)
    assert all(c.section_status == AMBIGUOUS and c.review_reason for c in changes)
    assert all(c.block_type == "SECTION" for c in changes)


def test_changes_follow_current_document_order() -> None:
    prev = doc(
        PREV,
        BASE_SECTIONS,
        [
            (1, 1, "PARAGRAPH", "본사는 수원입니다."),
            (2, 4, "PARAGRAPH", "제품은 DRAM입니다."),
        ],
    )
    cur = doc(
        CUR,
        BASE_SECTIONS,
        [
            (1, 1, "PARAGRAPH", "본사는 수원시 영통구입니다."),
            (2, 4, "PARAGRAPH", "제품은 DRAM과 NAND입니다."),
        ],
    )

    changes = diff_documents(prev, cur).changes

    assert [c.current.section_no for c in changes if c.current] == [1, 4]


def test_large_unmatched_runs_finish_quickly() -> None:
    prev_blocks = [(i, 3, "PARAGRAPH", f"이전 문장 {i} " + "가" * 200) for i in range(1, 400)]
    cur_blocks = [(i, 3, "PARAGRAPH", f"새 문장 {i} " + "나" * 200) for i in range(1, 400)]

    result = diff_documents(
        doc(PREV, BASE_SECTIONS, prev_blocks), doc(CUR, BASE_SECTIONS, cur_blocks)
    )

    assert len(result.changes) == 798


def test_many_similar_tables_finish_quickly() -> None:
    import random
    import time

    rng = random.Random(1)

    def table() -> str:
        words = ["매출", "원가", "자산", "부채", "합계", "기타"]
        rows = [
            " | ".join(rng.choice(words) + str(rng.randint(1, 9)) for _ in range(6))
            for _ in range(60)
        ]
        return "\n".join(rows)

    prev_blocks = [(i, 3, "TABLE", "구분 " + table()) for i in range(1, 61)]
    cur_blocks = [(i, 3, "TABLE", "항목 " + table()) for i in range(1, 61)]

    started = time.monotonic()
    result = diff_documents(
        doc(PREV, BASE_SECTIONS, prev_blocks), doc(CUR, BASE_SECTIONS, cur_blocks)
    )

    assert time.monotonic() - started < 10  # 백엔드가 AI 서버를 기다리는 시간(180초)보다 훨씬 짧게
    assert len(result.changes) >= 60


def test_children_of_a_renamed_parent_are_still_matched() -> None:
    prev_sections = [
        (1, None, 1, "I. 회사의 개요"),
        (2, None, 1, "II. 사업의 내용"),
        (3, 2, 2, "1. 사업의 개요"),
        (4, 2, 2, "2. 주요 제품"),
    ]
    cur_sections = [
        (1, None, 1, "I. 회사의 개요"),
        (2, None, 1, "II. 사업의 내용 및 현황"),
        (3, 2, 2, "1. 사업의 개요"),
        (4, 2, 2, "2. 주요 제품"),
    ]
    blocks = [(1, 3, "PARAGRAPH", "당사는 메모리를 만듭니다."), (2, 4, "PARAGRAPH", "DRAM")]
    cur_blocks = [
        (1, 3, "PARAGRAPH", "당사는 메모리를 만듭니다."),
        (2, 4, "PARAGRAPH", "DRAM과 NAND"),
    ]

    changes = diff_documents(
        doc(PREV, prev_sections, blocks), doc(CUR, cur_sections, cur_blocks)
    ).changes

    # 상위 이름이 0.8 미만으로 바뀌어도 하위 섹션을 통째로 추가·삭제로 보이지 않는다
    assert [(c.change_type, c.section_status) for c in changes] == [(MODIFIED, RENAMED)]
    assert changes[0].section_path == "II. 사업의 내용 및 현황 > 2. 주요 제품"


def test_same_titles_under_a_renamed_parent_pair_in_document_order() -> None:
    prev_sections = [
        (1, None, 1, "II. 사업의 내용"),
        (2, 1, 2, "가. 주요 계약"),
        (3, 1, 2, "가. 주요 계약"),
    ]
    cur_sections = [
        (1, None, 1, "II. 사업의 내용들"),
        (2, 1, 2, "가. 주요 계약"),
        (3, 1, 2, "가. 주요 계약"),
    ]
    blocks = [(1, 2, "PARAGRAPH", "A사와 공급 계약"), (2, 3, "PARAGRAPH", "B사와 기술 계약")]

    changes = diff_documents(
        doc(PREV, prev_sections, blocks), doc(CUR, cur_sections, blocks)
    ).changes

    assert changes == []


def test_parent_cycle_in_input_does_not_hang() -> None:
    sections = [(1, 1, 1, "I. 회사의 개요")]
    blocks = [(1, 1, "PARAGRAPH", "가")]

    result = diff_documents(doc(PREV, sections, blocks), doc(CUR, sections, blocks))

    assert result.changes == []


# ── 위치 이동(MOVED) ───────────────────────────────────────

MOVED_TEXT = "당사는 2025년부터 미국 텍사스주에 반도체 공장을 짓고 있습니다."


def test_paragraph_reordered_in_same_section_is_one_move() -> None:
    other_a = "주요 고객은 국내외 전자제품 제조사입니다."
    other_b = "공장은 화성과 평택에 있으며 계속 늘리고 있습니다."
    prev = doc(
        PREV,
        BASE_SECTIONS,
        [
            (1, 3, "PARAGRAPH", MOVED_TEXT),
            (2, 3, "PARAGRAPH", other_a),
            (3, 3, "PARAGRAPH", other_b),
        ],
    )
    cur = doc(
        CUR,
        BASE_SECTIONS,
        [
            (11, 3, "PARAGRAPH", other_a),
            (12, 3, "PARAGRAPH", other_b),
            (13, 3, "PARAGRAPH", MOVED_TEXT),
        ],
    )

    (change,) = diff_documents(prev, cur).changes

    assert change.change_type == MOVED
    assert change.previous is not None and change.current is not None
    assert (change.previous.section_no, change.previous.block_no) == (3, 1)
    assert (change.current.section_no, change.current.block_no) == (3, 13)
    assert change.section_path == "II. 사업의 내용 > 1. 사업의 개요"
    assert change.previous_section_path == change.section_path
    assert change.similarity == 1.0
    assert not change.numbers_only


def test_paragraph_moved_to_another_section_keeps_both_locations() -> None:
    prev = doc(
        PREV,
        BASE_SECTIONS,
        [(1, 3, "PARAGRAPH", MOVED_TEXT), (2, 4, "PARAGRAPH", "제품은 DRAM입니다.")],
    )
    cur = doc(
        CUR,
        BASE_SECTIONS,
        [(1, 4, "PARAGRAPH", "제품은 DRAM입니다."), (2, 4, "PARAGRAPH", MOVED_TEXT)],
    )

    (change,) = diff_documents(prev, cur).changes

    assert change.change_type == MOVED
    assert change.previous is not None and change.previous.section_no == 3
    assert change.current is not None and change.current.section_no == 4
    assert change.previous_section_path == "II. 사업의 내용 > 1. 사업의 개요"
    assert change.section_path == "II. 사업의 내용 > 2. 주요 제품"
    assert change.section_title == "2. 주요 제품"


def test_moved_paragraph_with_new_numbers_is_still_a_move() -> None:
    sentence = "당사의 임직원 수는 {}명이며 연구 인력이 많습니다."
    prev = doc(PREV, BASE_SECTIONS, [(1, 3, "PARAGRAPH", sentence.format("1,200"))])
    cur = doc(CUR, BASE_SECTIONS, [(1, 4, "PARAGRAPH", sentence.format("1,350"))])

    (change,) = diff_documents(prev, cur).changes

    assert change.change_type == MOVED
    assert change.similarity is not None and change.similarity < 1


def test_paragraph_moved_out_of_a_deleted_section_is_a_move() -> None:
    prev = doc(
        PREV,
        [*BASE_SECTIONS, (5, 2, 2, "3. 중단된 사업")],
        [(1, 5, "PARAGRAPH", MOVED_TEXT), (2, 5, "PARAGRAPH", "LCD 사업을 정리했습니다.")],
    )
    cur = doc(CUR, BASE_SECTIONS, [(1, 3, "PARAGRAPH", MOVED_TEXT)])

    changes = diff_documents(prev, cur).changes

    assert sorted(c.change_type for c in changes) == [DELETED, MOVED]
    moved = next(c for c in changes if c.change_type == MOVED)
    assert moved.previous_section_path == "II. 사업의 내용 > 3. 중단된 사업"
    assert moved.section_status == MATCHED


# 글자가 모두 다른 40자(비슷한 정도를 셈하기 쉽게)
DISTINCT_40 = "".join(chr(0xAC00 + i * 7) for i in range(40))


def _with_replaced(text: str, count: int) -> str:
    """앞에서부터 count 글자를 'X'로 바꾼 글"""
    return "".join("X" if i < count else ch for i, ch in enumerate(text))


def _move_between_sections(prev_text: str, cur_text: str) -> list:
    prev = doc(PREV, BASE_SECTIONS, [(1, 3, "PARAGRAPH", prev_text)])
    cur = doc(CUR, BASE_SECTIONS, [(1, 4, "PARAGRAPH", cur_text)])
    return diff_documents(prev, cur).changes


DISTINCT_38 = DISTINCT_40[:38]


def _with_commas(text: str, count: int) -> str:
    """5글자마다 쉼표를 하나씩, 모두 count개 넣은 글(문장부호만 다름)"""
    out = text
    for k in range(count, 0, -1):
        at = 5 * k
        out = out[:at] + "," + out[at:]
    return out


def test_move_threshold_includes_formatting_change_exactly_at_the_threshold() -> None:
    # 38자에 쉼표 4개를 넣으면 비슷한 정도 2*38/(38+42) = 0.95(경계 포함)
    assert MOVED_SIMILAR == 0.95
    changes = _move_between_sections(DISTINCT_38, _with_commas(DISTINCT_38, 4))

    assert [c.change_type for c in changes] == [MOVED]


def test_move_threshold_excludes_formatting_change_just_below_the_threshold() -> None:
    # 쉼표 5개면 2*38/(38+43) ≈ 0.938
    changes = _move_between_sections(DISTINCT_38, _with_commas(DISTINCT_38, 5))

    assert sorted(c.change_type for c in changes) == [ADDED, DELETED]


def test_similar_text_with_a_changed_word_is_not_a_move() -> None:
    # 40자 중 2자가 다르면 비슷한 정도는 0.95지만 글자가 바뀐 것이라 내용 변경이다
    changes = _move_between_sections(DISTINCT_40, _with_replaced(DISTINCT_40, 2))

    assert sorted(c.change_type for c in changes) == [ADDED, DELETED]


HEADER_2025 = "(기준일 : | 2025년 6월 30일 | ) | (단위 : 주, %)"


def test_table_header_with_a_changed_unit_is_not_a_move() -> None:
    # 실제 사례(분석 16, 2025.06 → 2026.06): 숫자를 가리면 단위(주 → 원)만 다르다
    prev = doc(PREV, BASE_SECTIONS, [(1, 3, "TABLE", HEADER_2025)])
    header = "(기준일 : | 2026년 06월 30일 | ) | (단위 : 원, %)"
    cur = doc(CUR, BASE_SECTIONS, [(1, 4, "TABLE", header)])

    changes = diff_documents(prev, cur).changes

    assert sorted(c.change_type for c in changes) == [ADDED, DELETED]


def test_formatting_only_difference_is_still_a_move() -> None:
    # 숫자 말고는 '기준일' 뒤 띄어쓰기 하나만 다르다
    prev = doc(PREV, BASE_SECTIONS, [(1, 3, "TABLE", HEADER_2025)])
    header = "(기준일: | 2026년 06월 30일 | ) | (단위 : 주, %)"
    cur = doc(CUR, BASE_SECTIONS, [(1, 4, "TABLE", header)])

    (change,) = diff_documents(prev, cur).changes

    assert change.change_type == MOVED
    assert change.previous_section_path == "II. 사업의 내용 > 1. 사업의 개요"


def test_formatting_only_differs_checks_every_differing_span() -> None:
    assert formatting_only_differs("단위 : 주, %", "단위: 주 , %")
    assert not formatting_only_differs("단위 : 주, %", "단위 : 원, %")
    assert not formatting_only_differs("매출 # 원", "매출 원")  # 숫자 자리가 빠짐
    assert not formatting_only_differs("비율 %", "비율 ‰")  # 기호가 바뀜


def test_short_boilerplate_is_not_paired_as_a_move() -> None:
    short = "해당사항 없음"
    assert len(short) < MOVED_MIN_CHARS
    changes = _move_between_sections(short, short)

    assert sorted(c.change_type for c in changes) == [ADDED, DELETED]


def test_text_exactly_at_min_length_can_move() -> None:
    text = DISTINCT_40[:MOVED_MIN_CHARS]
    changes = _move_between_sections(text, text)

    assert [c.change_type for c in changes] == [MOVED]


def test_moves_need_the_same_block_type() -> None:
    prev = doc(PREV, BASE_SECTIONS, [(1, 3, "PARAGRAPH", MOVED_TEXT)])
    cur = doc(CUR, BASE_SECTIONS, [(1, 4, "TABLE", MOVED_TEXT)])

    changes = diff_documents(prev, cur).changes

    assert sorted(c.change_type for c in changes) == [ADDED, DELETED]


def test_duplicate_moved_texts_pair_one_to_one_in_document_order() -> None:
    prev = doc(
        PREV,
        BASE_SECTIONS,
        [(1, 3, "PARAGRAPH", MOVED_TEXT), (2, 3, "PARAGRAPH", MOVED_TEXT)],
    )
    cur = doc(CUR, BASE_SECTIONS, [(5, 4, "PARAGRAPH", MOVED_TEXT)])

    changes = diff_documents(prev, cur).changes

    assert sorted(c.change_type for c in changes) == [DELETED, MOVED]
    moved = next(c for c in changes if c.change_type == MOVED)
    assert moved.previous is not None and moved.previous.block_no == 1


def test_long_texts_sharing_only_a_prefix_are_not_moves() -> None:
    head = " ".join(f"항목{i}" for i in range(400))
    prev = doc(PREV, BASE_SECTIONS, [(1, 3, "TABLE", head + " 끝 가나다")])
    cur = doc(CUR, BASE_SECTIONS, [(1, 4, "TABLE", head + " 다른 꼬리 라마바 사아자")])

    changes = diff_documents(prev, cur).changes

    assert sorted(c.change_type for c in changes) == [ADDED, DELETED]
