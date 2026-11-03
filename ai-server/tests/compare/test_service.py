from app.compare.listing import BUSINESS, DIVIDEND, HEADING, MAIN, PAIRED_TABLE, RowCounts
from app.compare.priority import HIGH
from app.compare.service import compare_documents
from app.compare.text_diff import ADDED, DELETED, BlockIn, DocumentIn, SectionIn

SECTIONS = [SectionIn(1, None, 1, "II. 사업의 내용")]


def test_each_change_gets_a_priority_from_its_own_text() -> None:
    previous = DocumentIn("20250311000001", SECTIONS, [])
    current = DocumentIn(
        "20260310000001",
        SECTIONS,
        [BlockIn(1, 1, "PARAGRAPH", "회사는 소송에 휘말렸습니다.")],
    )

    compared = compare_documents(previous, current)

    assert [c.change_type for c in compared.result.changes] == [ADDED]
    assert len(compared.priorities) == 1
    assert compared.priorities[0].level == HIGH
    assert "핵심어 '소송' +15" in compared.priorities[0].reasons


def test_each_change_gets_a_list_entry_from_its_own_text() -> None:
    previous = DocumentIn("20250311000001", SECTIONS, [])
    current = DocumentIn(
        "20260310000001",
        SECTIONS,
        [
            BlockIn(1, 1, "PARAGRAPH", "(2) 손상차손"),
            BlockIn(2, 1, "PARAGRAPH", "당사는 미국 텍사스주에 새 반도체 공장을 짓고 있습니다."),
        ],
    )

    compared = compare_documents(previous, current)

    assert [(e.group, e.field) for e in compared.entries] == [(HEADING, None), (MAIN, BUSINESS)]


def test_rebuilt_table_is_paired_by_its_rows() -> None:
    # 행 대부분이 달라 변경 탐지가 표를 삭제·추가 두 건으로 잡는다
    header = "사건번호 | 사건 내용과 진행 상황"
    old = [
        f"2024가합{i} | 손해배상 청구 소송이 제{i}심에서 계속 진행되고 있습니다" for i in range(20)
    ]
    new = [
        f"2026나{i} | 임대차 보증금 반환 다툼을 조정 절차로 마무리했습니다 {i}" for i in range(20)
    ]
    kept = "2025가합1 | 진행 중"
    previous = DocumentIn(
        "20250311000001", SECTIONS, [BlockIn(1, 1, "TABLE", "\n".join([header, kept, *old]))]
    )
    current = DocumentIn(
        "20260310000001", SECTIONS, [BlockIn(2, 1, "TABLE", "\n".join([header, kept, *new]))]
    )

    compared = compare_documents(previous, current)

    kinds = [c.change_type for c in compared.result.changes]
    assert sorted(kinds) == [ADDED, DELETED]
    by_kind = dict(zip(kinds, compared.entries, strict=True))
    assert by_kind[DELETED].group == PAIRED_TABLE
    assert by_kind[ADDED].row_diff.counts == RowCounts(changed=0, added=20, missing=20, same=1)


def test_missing_fields_come_from_both_documents() -> None:
    document = DocumentIn("20250311000001", SECTIONS, [])

    compared = compare_documents(document, document)

    assert BUSINESS not in compared.missing_fields
    assert DIVIDEND in compared.missing_fields
