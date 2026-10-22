from app.compare.text_diff import (
    ADDED,
    AMBIGUOUS,
    DELETED,
    MATCHED,
    MODIFIED,
    RENAMED,
    REVIEW_NEEDED,
    BlockIn,
    DocumentIn,
    SectionIn,
    diff_documents,
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


def test_table_with_only_new_numbers_is_numbers_only_modification() -> None:
    prev = doc(PREV, BASE_SECTIONS, [(1, 4, "TABLE", "제품 | 매출\nDRAM | 1,000")])
    cur = doc(CUR, BASE_SECTIONS, [(9, 4, "TABLE", "제품 | 매출\nDRAM | 1,250")])

    (change,) = diff_documents(prev, cur).changes

    assert change.change_type == MODIFIED
    assert change.block_type == "TABLE"
    assert change.numbers_only


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
