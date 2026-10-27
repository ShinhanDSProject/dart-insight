from app.summary.model import Source
from app.summary.search import CANDIDATE_LIMIT, MAX_SOURCE_CHARS, Index, bigrams, section_weight

CUR = "20260814001234"
MDNA = "IV. 이사의 경영진단 및 분석의견 > 2. 영업실적"
BUSINESS = "II. 사업의 내용 > 1. 사업의 개요"
NOTES = "III. 재무에 관한 사항 > 3. 연결재무제표 주석"


def block(no: int, path: str, text: str) -> Source:
    return Source(f"{CUR}#B{no}", path, text)


def ids(sources: list[Source]) -> list[str]:
    return [s.evidence_id for s in sources]


def test_text_is_split_into_two_letter_grams_without_spaces() -> None:
    assert bigrams("매출액") == ["매출", "출액"]
    assert bigrams("액") == ["액"]
    assert bigrams("") == []


def test_explaining_sections_are_weighted_first() -> None:
    assert section_weight(MDNA) == 1.5
    assert section_weight(BUSINESS) == 1.3
    assert section_weight(NOTES) == 1.0


def test_short_lines_and_paragraphs_without_the_term_are_not_candidates() -> None:
    index = Index(
        [
            block(1, BUSINESS, "(3) 판매경로별 매출액 비중"),  # 목차 제목 같은 짧은 줄
            block(2, BUSINESS, "당사는 메모리 반도체를 만들어 국내외 고객에게 판매하고 있습니다."),
            block(3, MDNA, "매출액은 메모리 수요 회복으로 전년 대비 크게 증가하였습니다."),
        ]
    )

    assert ids(index.candidates(["매출액"])) == [f"{CUR}#B3"]


def test_more_relevant_paragraph_ranks_before_earlier_one() -> None:
    index = Index(
        [
            block(
                1,
                BUSINESS,
                "주요 제품의 매출액 비중은 아래 표와 같으며 지역별로 나누어 적었습니다.",
            ),
            block(
                2,
                BUSINESS,
                "매출액은 전년 대비 증가하였으며, 영업수익과 매출액 모두 메모리 판매가 늘었습니다.",
            ),
        ]
    )

    assert ids(index.candidates(["매출액", "영업수익"])) == [f"{CUR}#B2", f"{CUR}#B1"]


def test_section_weight_breaks_otherwise_similar_paragraphs() -> None:
    text = "매출액은 메모리 수요 회복으로 전년 대비 증가하였습니다."
    index = Index([block(1, NOTES, text), block(2, BUSINESS, text), block(3, MDNA, text)])

    assert ids(index.candidates(["매출액"])) == [f"{CUR}#B3", f"{CUR}#B2", f"{CUR}#B1"]


def test_same_input_gives_same_candidates_in_same_order_with_ties_in_document_order() -> None:
    text = "영업이익은 원가 절감으로 전년 대비 개선되었습니다. 자세한 내용은 아래와 같습니다."
    blocks = [block(n, NOTES, text) for n in (7, 3, 9)]

    first = Index(blocks).candidates(["영업이익"])
    second = Index(blocks).candidates(["영업이익"])

    assert ids(first) == ids(second) == [f"{CUR}#B7", f"{CUR}#B3", f"{CUR}#B9"]


def test_at_most_the_limit_and_long_paragraphs_are_trimmed() -> None:
    long_text = "매출액이 늘었습니다. " + "가" * (MAX_SOURCE_CHARS + 100)
    blocks = [
        block(n, MDNA, long_text if n == 1 else f"{n}번 문단의 매출액 설명 문장을 길게 적었습니다.")
        for n in range(1, 9)
    ]

    found = Index(blocks).candidates(["매출액"])

    assert len(found) == CANDIDATE_LIMIT
    assert all(len(s.text) <= MAX_SOURCE_CHARS for s in found)


def test_no_terms_or_no_blocks_give_no_candidates() -> None:
    assert (
        Index([block(1, MDNA, "매출액은 메모리 수요 회복으로 증가하였습니다.")]).candidates([])
        == []
    )
    assert Index([]).candidates(["매출액"]) == []
