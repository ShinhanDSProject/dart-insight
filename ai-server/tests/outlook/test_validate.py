from app.outlook.model import EMPTY, GENERATED, OutlookInput, Source
from app.outlook.validate import check, normalize

RCEPT = "20260310000123"
FACILITY = Source(
    f"{RCEPT}#B310",
    "II. 사업의 내용 > 3. 원재료 및 생산설비",
    "당사는 평택   신규 라인 증설을\n2026년까지 완료할 계획입니다. 투자 규모는 30조 원입니다.",
)
MDNA = Source(
    f"{RCEPT}#B410",
    "IV. 이사의 경영진단 및 분석의견",
    "메모리 시장은 수요 회복으로 성장할 것으로 전망합니다. 배당은 연 2회 지급할 예정입니다.",
)
OUTLOOK = OutlookInput("예시전자", "사업보고서 (2025.12)", [FACILITY, MDNA])


def item(category: str, summary: str, quote: str, *ids: str) -> dict:
    return {"category": category, "summary": summary, "quote": quote, "evidenceIds": list(ids)}


def test_grounded_items_pass_with_whitespace_normalized_quote() -> None:
    data = {
        "items": [
            item(
                "INVESTMENT",
                "평택 신규 라인 증설을 2026년까지 마칠 계획이라고 밝혔어요.",
                "당사는 평택 신규 라인 증설을 2026년까지 완료할 계획입니다.",
                f"{RCEPT}#B310",
            ),
            item(
                "MARKET",
                "메모리 시장이 성장할 것으로 전망한다고 밝혔어요.",
                "메모리 시장은 수요 회복으로 성장할 것으로 전망합니다.",
                f"{RCEPT}#B410",
            ),
        ]
    }

    checked = check(data, OUTLOOK)

    assert checked.result is not None
    assert checked.result.status == GENERATED
    assert [i.category for i in checked.result.items] == ["INVESTMENT", "MARKET"]
    assert checked.result.items[0].evidence_ids == [f"{RCEPT}#B310"]


def test_zero_items_is_empty_not_failure() -> None:
    checked = check({"items": []}, OUTLOOK)

    assert checked.result is not None
    assert checked.result.status == EMPTY
    assert checked.result.items == []


def test_quote_not_in_cited_source_fails() -> None:
    # 문장은 B410에 있지만 B310만 인용했다
    checked = check(
        {
            "items": [
                item(
                    "FINANCIAL",
                    "배당을 연 2회 지급할 예정이라고 밝혔어요.",
                    "배당은 연 2회 지급할 예정입니다.",
                    f"{RCEPT}#B310",
                )
            ]
        },
        OUTLOOK,
    )

    assert checked.result is None
    assert "quote가 인용한 원문에 없습니다" in checked.problems[0]


def test_paraphrased_quote_fails() -> None:
    checked = check(
        {
            "items": [
                item(
                    "INVESTMENT",
                    "평택 라인을 늘릴 계획이라고 밝혔어요.",
                    "당사는 평택 라인을 크게 늘릴 계획입니다.",
                    f"{RCEPT}#B310",
                )
            ]
        },
        OUTLOOK,
    )

    assert checked.result is None


def test_unknown_evidence_fails() -> None:
    checked = check(
        {"items": [item("OTHER", "계획을 밝혔어요.", "당사는 평택 신규 라인", f"{RCEPT}#B999")]},
        OUTLOOK,
    )

    assert checked.result is None
    assert "주어진 원문 id가 아닙니다" in checked.problems[0]


def test_summary_number_must_be_in_quote() -> None:
    # 30조는 원문에 있지만 인용(quote)에는 없다
    checked = check(
        {
            "items": [
                item(
                    "INVESTMENT",
                    "30조 원을 들여 라인을 증설할 계획이라고 밝혔어요.",
                    "당사는 평택 신규 라인 증설을 2026년까지 완료할 계획입니다.",
                    f"{RCEPT}#B310",
                )
            ]
        },
        OUTLOOK,
    )

    assert checked.result is None
    assert "숫자" in checked.problems[0]


def test_unknown_category_fails() -> None:
    checked = check(
        {
            "items": [
                item(
                    "VALUATION",
                    "증설 계획을 밝혔어요.",
                    "당사는 평택 신규 라인 증설을",
                    f"{RCEPT}#B310",
                )
            ]
        },
        OUTLOOK,
    )

    assert checked.result is None
    assert "category" in checked.problems[0]


def test_prediction_or_recommendation_is_blocked_with_rule_id() -> None:
    checked = check(
        {
            "items": [
                item(
                    "MARKET",
                    "시장 성장 전망으로 주가가 오를 것으로 기대돼요.",
                    "메모리 시장은 수요 회복으로 성장할 것으로 전망합니다.",
                    f"{RCEPT}#B410",
                )
            ]
        },
        OUTLOOK,
    )

    assert checked.result is None
    assert checked.blocked_rules == ["PRICE_FORECAST"]


def test_too_many_items_fail() -> None:
    one = item(
        "INVESTMENT",
        "증설 계획을 밝혔어요.",
        "당사는 평택 신규 라인 증설을",
        f"{RCEPT}#B310",
    )

    checked = check({"items": [one] * 11}, OUTLOOK)

    assert checked.result is None


def test_normalize_unescapes_prompt_entities_and_collapses_spaces() -> None:
    assert normalize("  A &lt;B&gt;\n\n C &amp; D ") == "A <B> C & D"
