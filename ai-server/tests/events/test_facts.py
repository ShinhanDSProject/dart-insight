import pytest

from app.events.facts import fact_problem

SOURCE = (
    "2025년 3월 5일 ㈜영풍이 당사를 상대로 서울중앙지방법원 2025가합12345 소송을 제기했습니다. "
    "청구 금액은 1,200억원이고 지분 13.5%와 관련되며 미래에셋증권이 주관사이고 "
    "MBK 파트너스가 참여했습니다. 관련 소송은 2건입니다."
)


@pytest.mark.parametrize(
    "title",
    [
        "㈜영풍의 소송 제기",
        "(주)영풍과의 소송",
        "2025년 3월 5일 소송 제기",
        "2025.03.05 소송 제기",
        "3월 5일 소송 제기",
        "2025가합12345 소송",
        "2025 가합 12345 소송",
        "1,200억원 규모 소송",
        "지분 13.5% 관련 소송",
        "소송 2건 제기",
        "미래에셋증권 주관",
        "mbk 파트너스 참여",
        "소송 제기",
    ],
)
def test_title_with_facts_in_source_passes(title: str) -> None:
    assert fact_problem(title, SOURCE) is None


@pytest.mark.parametrize(
    "title",
    [
        "1,500억원 규모 소송",
        "1,200 조원 규모 소송",
        "지분 15% 관련 소송",
        "2024년 3월 5일 소송 제기",
        "2025년 5월 3일 소송 제기",
        "5월 3일 소송 제기",
        "2025.05.03 소송 제기",
        "2025나12345 소송",
        "소송 3건 제기",
        "소송 세 건 제기",
        "㈜고려제강의 소송 제기",
        "주식회사 고려제강의 소송 제기",
        "고려제강㈜의 소송 제기",
        "한국투자증권 주관",
        "KKR 참여",
    ],
)
def test_title_with_facts_not_in_source_is_a_problem(title: str) -> None:
    assert fact_problem(title, SOURCE) is not None


def test_percent_written_differently_from_source_is_a_problem() -> None:
    assert fact_problem("지분 13.5 퍼센트", "지분 13.5%") is not None


def test_year_month_date_is_found_in_full_source_date() -> None:
    assert fact_problem("2025년 3월 소송 제기", SOURCE) is None


def test_full_date_passes_when_source_writes_year_apart_from_month_and_day() -> None:
    assert fact_problem("2025년 3월 5일 제기", "2025년 중 3월 5일 제기했습니다") is None


def test_company_marker_before_a_plain_word_does_not_treat_that_word_as_a_name() -> None:
    assert fact_problem("영풍 주식회사 상대 소송", "영풍 주식회사가 소송을 제기") is None
