from app.briefing.model import GENERATED, OVERVIEW, SALES, BriefingInput, Source
from app.briefing.validate import check

RCEPT = "20260310000123"
OVERVIEW_SOURCE = Source(
    f"{RCEPT}#B120",
    OVERVIEW,
    "II. 사업의 내용 > 1. 사업의 개요",
    "당사는 반도체와 스마트폰을 만들어 국내외에 판매하고 있습니다.",
)
SALES_SOURCE = Source(
    f"{RCEPT}#B140",
    SALES,
    "II. 사업의 내용 > 4. 매출 및 수주상황",
    "당기 매출액은 300조 원이며, 반도체 부문이 40%를 차지합니다.",
)
BRIEFING = BriefingInput("예시전자", "사업보고서 (2025.12)", [OVERVIEW_SOURCE, SALES_SOURCE])


def sentence(text: str, *ids: str) -> dict:
    return {"text": text, "evidenceIds": list(ids)}


def test_grounded_sentences_pass_and_markers_are_removed() -> None:
    data = {
        "sentences": [
            sentence(f"회사는 반도체와 스마트폰을 만들어요[{RCEPT}#B120].", f"{RCEPT}#B120"),
            sentence("매출액은 300조 원이고 반도체가 40%예요.", f"{RCEPT}#B140"),
        ]
    }

    checked = check(data, BRIEFING)

    assert checked.result is not None
    assert checked.result.status == GENERATED
    assert [s.text for s in checked.result.sentences] == [
        "회사는 반도체와 스마트폰을 만들어요.",
        "매출액은 300조 원이고 반도체가 40%예요.",
    ]
    assert checked.result.sentences[1].evidence_ids == [f"{RCEPT}#B140"]


def test_sentence_without_evidence_fails() -> None:
    checked = check({"sentences": [sentence("회사는 반도체를 만들어요.")]}, BRIEFING)

    assert checked.result is None
    assert "근거가 없습니다" in checked.problems[0]


def test_unknown_evidence_fails() -> None:
    checked = check(
        {"sentences": [sentence("회사는 반도체를 만들어요.", f"{RCEPT}#B999")]}, BRIEFING
    )

    assert checked.result is None
    assert "주어진 원문 id가 아닙니다" in checked.problems[0]


def test_number_not_in_cited_source_fails() -> None:
    # 매출액 숫자는 B140에 있지만 이 문장은 B120만 인용했다
    checked = check(
        {"sentences": [sentence("매출액은 300조 원이에요.", f"{RCEPT}#B120")]}, BRIEFING
    )

    assert checked.result is None
    assert "숫자" in checked.problems[0]


def test_calculated_number_fails() -> None:
    checked = check(
        {"sentences": [sentence("반도체 매출은 120조 원이에요.", f"{RCEPT}#B140")]}, BRIEFING
    )

    assert checked.result is None


def test_value_judgment_is_blocked_with_rule_id() -> None:
    checked = check(
        {"sentences": [sentence("회사는 저평가된 반도체 회사예요.", f"{RCEPT}#B120")]}, BRIEFING
    )

    assert checked.result is None
    assert checked.blocked_rules == ["VALUE_JUDGMENT"]


def test_causal_claim_needs_causal_source() -> None:
    checked = check(
        {"sentences": [sentence("반도체 때문에 매출이 커요.", f"{RCEPT}#B140")]}, BRIEFING
    )

    assert checked.result is None
    assert "원인 표현" in checked.problems[0]


def test_too_many_or_no_sentences_fail() -> None:
    one = sentence("회사는 반도체를 만들어요.", f"{RCEPT}#B120")

    assert check({"sentences": []}, BRIEFING).result is None
    assert check({"sentences": [one] * 7}, BRIEFING).result is None
    assert check({"text": "형식이 다름"}, BRIEFING).result is None
    assert check("not json object", BRIEFING).result is None


def test_too_long_sentence_fails() -> None:
    checked = check({"sentences": [sentence("가" * 161, f"{RCEPT}#B120")]}, BRIEFING)

    assert checked.result is None
