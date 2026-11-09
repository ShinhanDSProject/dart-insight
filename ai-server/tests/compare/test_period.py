import pytest

from app.compare.period import PeriodShift, period_only, period_shift
from app.compare.text_diff import BlockIn, DocumentIn, SectionIn

# 삼성전자 반기보고서 표지(20250814003156 → 20260814003699)
PREVIOUS_COVER = ["(제 57 기)", "사업연도 | 2025년 01월 01일 | 부터\n2025년 06월 30일 | 까지"]
CURRENT_COVER = ["(제 58 기)", "사업연도 | 2026년 01월 01일 | 부터\n2026년 06월 30일 | 까지"]
YEARLY = PeriodShift(
    1, 1, frozenset({((2025, 1, 1), (2026, 1, 1)), ((2025, 6, 30), (2026, 6, 30))})
)


def document(rcept: str, cover: list[str]) -> DocumentIn:
    sections = [
        SectionIn(1, None, 1, "반 기 보 고 서", True),
        SectionIn(2, None, 1, "I. 회사의 개요"),
    ]
    blocks = [BlockIn(i, 1, "PARAGRAPH", text) for i, text in enumerate(cover)]
    blocks.append(
        BlockIn(len(cover), 2, "PARAGRAPH", "(제 99 기) 사업연도 2000년 01월 01일 부터 까지")
    )
    return DocumentIn(rcept, sections, blocks)


def test_period_shift_reads_term_and_fiscal_period_from_the_cover() -> None:
    shift = period_shift(
        document("20250814003156", PREVIOUS_COVER), document("20260814003699", CURRENT_COVER)
    )
    assert shift == YEARLY


def test_period_shift_is_none_without_a_term_on_the_cover() -> None:
    previous = document("20250814003156", PREVIOUS_COVER[1:])
    assert period_shift(previous, document("20260814003699", CURRENT_COVER)) is None


def test_period_shift_is_none_without_a_fiscal_period_on_the_cover() -> None:
    current = document("20260814003699", CURRENT_COVER[:1])
    assert period_shift(document("20250814003156", PREVIOUS_COVER), current) is None


def test_period_shift_follows_the_comparison_interval() -> None:
    # 같은 해 1분기 → 반기: 기수·연도는 그대로이고 끝 날짜만 바뀐다
    previous = document(
        "20250515000001", ["(제 57 기)", "사업연도 2025년 01월 01일 부터 2025년 03월 31일 까지"]
    )
    current = document(
        "20250814000001", ["(제 57 기)", "사업연도 2025년 01월 01일 부터 2025년 06월 30일 까지"]
    )
    shift = period_shift(previous, current)
    assert shift is not None and (shift.terms, shift.years) == (0, 0)
    assert period_only("(기준일 : 2025년 03월 31일)", "(기준일 : 2025년 06월 30일)", shift)
    assert not period_only("2025년(제57기) 반기", "2026년(제58기) 반기", shift)


@pytest.mark.parametrize(
    ("previous", "current"),
    [
        ("(제 57 기)", "(제 58 기)"),
        ("(기준일 : | 2025년 06월 30일 | )", "(기준일 : | 2026년 06월 30일 | )"),
        ("한국거래소 귀중 | 2025년 8월 14일", "한국거래소 귀중 | 2026년 08월 14일"),
        (
            "2025년 반기 중 당사의 주요 연구개발 실적은 다음과 같습니다.",
            "2026년 반기 중 당사의 주요 연구개발 실적은 다음과 같습니다.",
        ),
        (
            "재무상태표 제 57 기 반기말 2025.06.30 현재 제 56 기말 2024.12.31 현재",
            "재무상태표 제 58 기 반기말 2026.06.30 현재 제 57 기말 2025.12.31 현재",
        ),
        (
            "부 문 | 제57기 반기 | 제56기\nDX | 100 | 90",
            "부 문 | 제58기 반기 | 제57기\nDX | 100 | 90",
        ),
    ],
)
def test_text_whose_only_change_is_the_period_is_period_only(previous: str, current: str) -> None:
    assert period_only(previous, current, YEARLY)


def test_another_changed_number_is_not_period_only() -> None:
    previous = "2025년(제57기) 반기 DX 부문의 TV, 모니터 등 생산실적은 20,479천대입니다."
    current = "2026년(제58기) 반기 DX 부문의 TV, 모니터 등 생산실적은 21,893천대입니다."
    assert not period_only(previous, current, YEARLY)


def test_term_that_jumps_more_than_the_interval_is_not_period_only() -> None:
    assert not period_only("제55기 반기 실적", "제57기 반기 실적", YEARLY)


def test_date_whose_day_changed_is_not_period_only() -> None:
    assert not period_only("2024년 3월 20일 기준", "2025년 3월 18일 기준", YEARLY)


def test_bylaws_history_is_not_period_only() -> None:
    previous = "당사는 제55기 정기주주총회(2024년 3월 20일)에서 정관 일부를 변경하였습니다."
    current = "당사는 제57기 정기주주총회(2026년 3월 18일)에서 정관 일부를 변경하였습니다."
    assert not period_only(previous, current, YEARLY)


@pytest.mark.parametrize("word", ["정기주주총회", "이사회", "계약", "소송"])
def test_event_words_keep_the_text_even_when_the_term_shifts_exactly(word: str) -> None:
    assert not period_only(f"제57기 {word} 개최", f"제58기 {word} 개최", YEARLY)


def test_text_without_a_changed_period_is_not_period_only() -> None:
    assert not period_only("2025년 반기 실적", "2025년  반기 실적", YEARLY)


def test_extra_period_mark_is_not_period_only() -> None:
    assert not period_only("2025년 반기", "2026년 반기 (2025년 대비)", YEARLY)


def test_changed_period_kind_is_not_period_only() -> None:
    assert not period_only("(제 10기 반기)", "(제 11기)", YEARLY)
