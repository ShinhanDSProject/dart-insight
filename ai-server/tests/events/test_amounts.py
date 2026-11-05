from decimal import Decimal

import pytest

from app.events.amounts import PER_SHARE, AmountSource, extract_amounts

EVIDENCE = "20260814003699#B100"


def source(
    text: str,
    is_table: bool = False,
    preceding_text: str | None = None,
    change_no: int = 1,
) -> AmountSource:
    return AmountSource(change_no, EVIDENCE, text, is_table, preceding_text)


def values(text: str, **kwargs: object) -> list[tuple[str, Decimal]]:
    extracted = extract_amounts([source(text, **kwargs)])  # type: ignore[arg-type]
    return [(c.currency, c.value) for c in extracted.candidates]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("벌금 5,000,000원을 납부", 5_000_000),
        ("출자금 300,000,000천원", 300_000_000_000),
        ("과징금 8,428.1백만원", 8_428_100_000),
        ("과태료 480만원", 4_800_000),
        ("투자금 4,000억원", 400_000_000_000),
        ("시설투자 28.0조원", 28_000_000_000_000),
        ("계약 금액 1조 2,000억원", 1_200_000_000_000),
        ("계약 금액 3조 5,000억 2,000만원", 3_500_020_000_000),
    ],
)
def test_won_units_are_normalized(text: str, expected: int) -> None:
    assert values(text) == [("KRW", Decimal(expected))]


def test_original_text_context_and_evidence_are_kept() -> None:
    (candidate,) = extract_amounts(
        [source("당사는 과징금 8,428.1백만원을 납부했습니다.")]
    ).candidates

    assert candidate.text == "8,428.1백만원"
    assert candidate.context == "당사는 과징금 8,428.1백만원을 납부했습니다."
    assert candidate.change_no == 1
    assert candidate.evidence_id == EVIDENCE
    assert candidate.from_table is False


def test_context_is_the_whole_sentence_of_the_amount() -> None:
    text = (
        "당사는 자기주식을 매입 중이며, 매입 예상 규모는 약 3,911,908백만원으로 추정하고 있습니다. "
        "미국 회사 젤스의 지분 100%를 인수하였습니다."
    )

    (candidate,) = extract_amounts([source(text)]).candidates

    assert candidate.context == (
        "당사는 자기주식을 매입 중이며, 매입 예상 규모는 약 3,911,908백만원으로 추정하고 있습니다."
    )


def test_decimal_point_in_the_amount_does_not_end_the_sentence() -> None:
    text = "앞 문장입니다. 과징금 8,428.1백만원을 납부했습니다. 뒤 문장입니다."

    (candidate,) = extract_amounts([source(text)]).candidates

    assert candidate.context == "과징금 8,428.1백만원을 납부했습니다."


def test_context_of_a_very_long_sentence_is_limited_on_each_side() -> None:
    text = "가" * 400 + " 100억원 " + "나" * 400

    (candidate,) = extract_amounts([source(text)]).candidates

    assert candidate.context == "가" * 199 + " 100억원 " + "나" * 199


def test_written_amount_in_a_table_has_its_whole_row_as_context() -> None:
    text = "구분 | 내용\nA사 | 벌금 1억원 부과 | 납부 완료\nB사 | 시정명령"

    (candidate,) = extract_amounts([source(text, True)]).candidates

    assert candidate.context == "A사 | 벌금 1억원 부과 | 납부 완료"


@pytest.mark.parametrize(
    "text",
    [
        "제3원칙에 따라",
        "임직원 5,000명",
        "2026년 3월 5일",
    ],
)
def test_text_without_money_has_no_candidate(text: str) -> None:
    assert values(text) == []


@pytest.mark.parametrize(
    "text",
    [
        "1주당 액면가 5,000원",
        "1주당 5,000원",
        "주당 배당금 15,000원",
        "액면금액 5,000원",
        "발행가액 2,242,301원",
        "행사가격 10,000원",
        "전환가액 10,000원",
        "기준주가 100,000원",
        "보통주 15,000원/주",
    ],
)
def test_per_share_amount_is_excluded_with_reason(text: str) -> None:
    extracted = extract_amounts([source(text)])

    assert extracted.candidates == []
    assert [e.reason for e in extracted.excluded] == ["PER_SHARE"]


def test_per_share_word_does_not_exclude_amount_of_next_clause() -> None:
    assert values("1주당 5,000원, 총 발행금액 2,000억원") == [("KRW", Decimal(200_000_000_000))]


@pytest.mark.parametrize(
    ("text", "currency", "rate"),
    [
        ("적용 환율 1USD = 1,460.60원", "USD", "1460.60"),
        ("1 USD당 1,460.60원", "USD", "1460.60"),
        ("USD 1 = 1,460.60원", "USD", "1460.60"),
        ("1달러당 1,460.60원", "USD", "1460.60"),
        ("1,460.60원/USD", "USD", "1460.60"),
        ("1EUR = 1,600원", "EUR", "1600"),
        ("1CNY = 200.5원", "CNY", "200.5"),
        ("100JPY = 950원", "JPY", "9.50"),
        ("100엔당 950원", "JPY", "9.50"),
    ],
)
def test_rate_text_is_kept_as_disclosed_rate_and_not_a_candidate(
    text: str, currency: str, rate: str
) -> None:
    extracted = extract_amounts([source(text)])

    assert extracted.candidates == []
    assert extracted.disclosed_rates == {currency: Decimal(rate)}
    assert [e.reason for e in extracted.excluded] == ["FX_RATE_TEXT"]


def test_amount_after_the_word_rate_is_excluded() -> None:
    extracted = extract_amounts([source("매매기준율 환율 1,460.60원")])

    assert extracted.candidates == []
    assert extracted.disclosed_rates == {}
    assert [e.reason for e in extracted.excluded] == ["FX_RATE_TEXT"]


@pytest.mark.parametrize(
    ("text", "currency", "expected"),
    [
        ("벌금 USD 11,800,000 납부", "USD", "11800000"),
        ("US$ 1,000", "USD", "1000"),
        ("$500 지급", "USD", "500"),
        ("USD 7,432 백만", "USD", "7432000000"),
        ("미화 11,800,000달러", "USD", "11800000"),
        ("3,000백만 달러", "USD", "3000000000"),
        ("EUR 1,000", "EUR", "1000"),
        ("2,000유로", "EUR", "2000"),
        ("JPY 5,000", "JPY", "5000"),
        ("5,000엔을 지급", "JPY", "5000"),
        ("CNY 300", "CNY", "300"),
        ("300위안", "CNY", "300"),
    ],
)
def test_foreign_amount_stays_a_candidate(text: str, currency: str, expected: str) -> None:
    assert values(text) == [(currency, Decimal(expected))]


def test_amount_and_rate_in_same_text_are_separated() -> None:
    extracted = extract_amounts([source("벌금 USD 11,800,000, 적용 환율 1USD = 1,400원")])

    assert [(c.currency, c.value) for c in extracted.candidates] == [("USD", Decimal(11_800_000))]
    assert extracted.disclosed_rates == {"USD": Decimal(1400)}


@pytest.mark.parametrize("word", ["합계", "누계", "한도", "총액"])
def test_amount_next_to_total_word_is_marked(word: str) -> None:
    (candidate,) = extract_amounts([source(f"소송 {word} 1조원")]).candidates

    assert candidate.total_like is True


def test_total_word_of_other_clause_does_not_mark() -> None:
    (first, second) = extract_amounts([source("과징금 100억원, 소송 합계 1조원")]).candidates

    assert first.total_like is False
    assert second.total_like is True


def test_table_unit_inside_table_applies_to_number_cells() -> None:
    text = "(단위 : 백만원)\n구분 | 금액\n과징금 | 8,428"

    assert values(text, is_table=True) == [("KRW", Decimal(8_428_000_000))]


def test_table_unit_in_preceding_block_applies_to_number_cells() -> None:
    (candidate,) = extract_amounts(
        [source("소송 건수 | 25\n소송 금액 | 13,924,465", True, "법적소송 (단위 : 천원)")]
    ).candidates

    assert candidate.value == Decimal(13_924_465_000)
    assert candidate.text == "13,924,465 (단위: 천원)"
    assert candidate.from_table is True
    assert "소송 금액" in candidate.context


def test_cell_context_has_the_whole_row_and_its_column_heads() -> None:
    text = "회사 | 처분일 | 금액\nA사 | 2025.11.05 | 0.8\nB사 | 2025.12.01 | 3"

    candidates = extract_amounts([source(text, True, "(단위: 백만원)")]).candidates

    assert candidates[0].context == "A사 | 2025.11.05 | 0.8 (칸: 금액, 0.8 (단위: 백만원))"
    assert candidates[1].context == "B사 | 2025.12.01 | 3 (칸: 금액, 3 (단위: 백만원))"


def test_unit_that_is_not_money_reads_no_cells() -> None:
    assert (
        values("구분 | 사망자 수\n본사 | 12,000", is_table=True, preceding_text="(단위: 명)") == []
    )


def test_table_without_unit_reads_no_cells() -> None:
    assert values("구분 | 금액\n과징금 | 8,428", is_table=True) == []


def test_preceding_text_is_not_used_for_paragraphs() -> None:
    assert values("과징금 8,428 납부", preceding_text="(단위 : 백만원)") == []


@pytest.mark.parametrize(
    "row",
    [
        "소송 건수 | 25",
        "지분율 | 13",
        "비율(%) | 13",
        "발행주식수 | 1,000",
        "구분 | 2025",
        "금액 | 0",
        "금액 | -",
        "금액 | 2025.06.30",
    ],
)
def test_table_cells_that_are_not_amounts_are_skipped(row: str) -> None:
    assert values(row, is_table=True, preceding_text="(단위 : 천원)") == []


def test_money_written_in_table_cell_uses_its_own_unit_only_once() -> None:
    text = "벌금 | 6,600,000원\n과태료 | 100"

    assert values(text, is_table=True, preceding_text="(단위 : 천원)") == [
        ("KRW", Decimal(6_600_000)),
        ("KRW", Decimal(100_000)),
    ]


def test_foreign_unit_in_table_head_applies_to_cells() -> None:
    assert values("구분 | 금액\n벌금 | 11.8", is_table=True, preceding_text="(단위 : 백만USD)") == [
        ("USD", Decimal(11_800_000))
    ]


def test_same_currency_and_value_are_merged_across_changes() -> None:
    extracted = extract_amounts(
        [source("벌금 100억원", change_no=1), source("벌금 10,000백만원", change_no=2)]
    )

    assert [c.change_no for c in extracted.candidates] == [1]


def test_same_value_in_other_currency_is_kept() -> None:
    assert len(extract_amounts([source("USD 100 또는 EUR 100")]).candidates) == 2


def test_unit_written_out_of_order_is_excluded_not_guessed() -> None:
    extracted = extract_amounts([source("3천5백만원")])

    assert extracted.candidates == []
    assert [e.reason for e in extracted.excluded] == ["UNREADABLE"]


def test_cells_under_a_two_row_header_are_judged_by_their_own_column() -> None:
    table = (
        "주식발행일자 | 발행형태 | 발행한 주식의 내용\n"
        "종류 | 수량 | 주당액면가액 | 주당발행가액 | 비고\n"
        "2025년 12월 27일 | 유상증자 | 보통주 | 2,209,716 | 5,000 | 1,282,319 | 10.6%"
    )

    extracted = extract_amounts([AmountSource(1, "R#B1", table, True, "(단위 : 원, 주)")])

    assert extracted.candidates == []


def test_written_amount_in_a_table_row_about_one_share_is_excluded() -> None:
    table = (
        "3. 신주 발행가액 | 2,242,301원 (USD 1,490)\n"
        "6. 발행총액 | 39,890,534,790,000원 (USD 26,507,100,000)"
    )

    extracted = extract_amounts([AmountSource(1, "R#B1", table, True)])

    assert [c.value for c in extracted.candidates] == [
        Decimal("39890534790000"),
        Decimal("26507100000"),
    ]
    assert {e.reason for e in extracted.excluded} == {PER_SHARE}


def test_row_with_its_own_currency_and_unit_is_not_read_with_the_table_unit() -> None:
    table = " | 주요한 보통주 거래\n출자대금납입 [AUD, 천] | 199,031"

    extracted = extract_amounts([AmountSource(1, "R#B1", table, True, " | (단위 : 천원)")])

    assert extracted.candidates == []


def test_total_column_is_marked_and_its_header_is_in_the_context() -> None:
    table = "구분 | 1년 이하 | 합계\n사모 | 770,750 | 8,571,175"

    extracted = extract_amounts([AmountSource(1, "R#B1", table, True, "(단위 : 백만원)")])

    first, second = extracted.candidates
    assert (first.total_like, second.total_like) == (False, True)
    assert "1년 이하" in first.context
    assert "합계" in second.context
