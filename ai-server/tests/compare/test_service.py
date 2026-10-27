from app.compare.priority import HIGH
from app.compare.service import compare_documents
from app.compare.text_diff import ADDED, BlockIn, DocumentIn, SectionIn

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
