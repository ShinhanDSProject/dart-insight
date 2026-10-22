import pytest

from app.compliance import RULESET_VERSION, scan

BLOCKED = [
    ("지금 매수하세요.", "TRADE_RECOMMENDATION"),
    ("매도 의견을 냈어요.", "TRADE_RECOMMENDATION"),
    ("주식을 사야 합니다.", "TRADE_RECOMMENDATION"),
    ("저점 매수 기회예요.", "TRADE_RECOMMENDATION"),
    ("포트폴리오 비중을 늘리세요.", "TRADE_RECOMMENDATION"),
    ("투자를 권합니다.", "INVESTMENT_ADVICE"),
    ("지금이 살 때예요.", "INVESTMENT_ADVICE"),
    ("목표주가는 10만 원이에요.", "TARGET_PRICE"),
    ("적정 주가를 넘었어요.", "TARGET_PRICE"),
    ("주가가 오를 것으로 보여요.", "PRICE_FORECAST"),
    ("주가는 내년에 하락할 수 있어요.", "PRICE_FORECAST"),
    ("주가 전망이 밝아요.", "PRICE_FORECAST"),
    ("동종 업계보다 저평가돼 있어요.", "VALUE_JUDGMENT"),
    ("투자 매력이 커졌어요.", "VALUE_JUDGMENT"),
    ("이번 공시는 호재예요.", "VALUE_JUDGMENT"),
    ("원금이 보장돼요.", "RETURN_GUARANTEE"),
    ("확실한 수익을 낼 수 있어요.", "RETURN_GUARANTEE"),
]

# 공시에 흔히 나오는 사실 문장은 막지 않는다
ALLOWED = [
    "자기주식 매도 계획이 새로 들어갔어요.",
    "매도가능금융자산 분류가 바뀌었어요.",
    "주식매수선택권 부여 내용이 추가됐어요.",
    "해외 매출 비중 확대를 위해 공장을 짓는다고 적었어요.",
    "주가 변동 위험에 관한 문단이 추가됐어요.",
    "회사는 신규 투자 기회를 모색한다고 적었어요.",
    "매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%).",
    "바닥재 사업부를 매각했어요.",
    "목표 가격 정책을 설명하는 문단이 생겼어요.",
]


@pytest.mark.parametrize(("text", "rule"), BLOCKED)
def test_recommendation_forecast_and_judgment_are_caught(text: str, rule: str) -> None:
    assert rule in [f.rule_id for f in scan(text)]


@pytest.mark.parametrize("text", ALLOWED)
def test_factual_disclosure_sentences_pass(text: str) -> None:
    assert scan(text) == []


def test_finding_carries_label_and_matched_text() -> None:
    [finding] = scan("목표주가를 올렸어요.")
    assert finding.label == "목표주가"
    assert finding.matched == "목표주가"
    assert scan(None) == []
    assert RULESET_VERSION == "expr-1"
