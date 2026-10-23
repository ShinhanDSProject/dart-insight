import pytest

from app.summary.causal import find

CAUSAL = [
    ("메모리 수요가 줄었기 때문에 매출이 줄었어요.", "때문"),
    ("환율 하락 탓에 영업이익이 줄었어요.", "탓"),
    ("신제품 출시 덕분에 매출이 늘었어요.", "덕분"),
    ("판매 단가 하락으로 인해 매출이 줄었어요.", "으로 인해"),
    ("원가 상승으로인한 손실이 있었어요.", "으로인한"),
    ("재고 평가손실로 인하여 이익이 줄었어요.", "로 인하여"),
    ("이익 감소는 일회성 비용에 기인해요.", "에 기인"),
    ("금리 상승의 영향으로 금융비용이 늘었어요.", "영향으로"),
    ("업황 둔화의 영향을 받아 매출이 줄었어요.", "영향을 받아"),
    ("구조조정의 결과로 비용이 줄었어요.", "결과로"),
]

# 간접 인과와 원인을 말하지 않는 문장은 걸지 않는다
NOT_CAUSAL = [
    "회계기준 변경에 따라 재분류했어요.",
    "관련 공시 내용으로 신규 공장 가동 계획이 있어요.",
    "해외 매출이 실적 개선에 기여했어요.",
    "고부가 제품이 매출 성장을 견인했어요.",
    "환율 변동이 영업이익에 영향을 줄 수 있다고 적었어요.",
    "회사는 경영진단에서 영업이익 변화를 설명했어요.",
]


@pytest.mark.parametrize(("text", "matched"), CAUSAL)
def test_explicit_causal_expressions_are_found(text: str, matched: str) -> None:
    assert find(text) == matched


@pytest.mark.parametrize("text", NOT_CAUSAL)
def test_indirect_or_non_causal_sentences_are_not_found(text: str) -> None:
    assert find(text) is None


def test_empty_text_has_no_causal_expression() -> None:
    assert find(None) is None
    assert find("") is None
