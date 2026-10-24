import pytest

from app.compliance import OUT_OF_SCOPE_QUESTION, scan_question

OUT_OF_SCOPE = [
    "지금 사야 하나요?",
    "이 회사 주식 팔아야 할까요?",
    "지금 살까요?",
    "사도 될까요?",
    "매수해도 될까요?",
    "매도해야 하나요?",
    "매수 타이밍인가요?",
    "투자해도 될까요?",
    "투자할 만한 회사인가요?",
    "목표주가가 얼마예요?",
    "적정 주가는요?",
    "주가 오를까요?",
    "주가가 내년에 떨어질까요?",
    "앞으로 주가 전망은 어때요?",
    "이 주식 오를까요?",
    "주가는 어떻게 될까요?",
    "종목 추천해 주세요.",
    "지금 저평가인가요?",
    "손절해야 하나요?",
]

# 공시 내용을 묻는 질문은 막지 않는다
IN_SCOPE = [
    "매출액은 왜 늘었나요?",
    "자기주식 매도 계획이 있나요?",
    "주식매수선택권 부여 내용이 바뀌었나요?",
    "투자 계획이 바뀌었나요?",
    "회사가 해외에 투자한 이유는 뭔가요?",
    "주가 변동 위험에 대해 뭐라고 적었나요?",
    "주가가 하락한 이유를 공시에서 설명했나요?",
    "회사가 공장을 판 이유는요?",
    "영업이익 전망을 공시에 적었나요?",
    "자산 평가 방법이 바뀌었나요?",
    "",
]


@pytest.mark.parametrize("question", OUT_OF_SCOPE)
def test_investment_questions_are_out_of_scope(question: str) -> None:
    findings = scan_question(question)

    assert [f.rule_id for f in findings] == [OUT_OF_SCOPE_QUESTION]


@pytest.mark.parametrize("question", IN_SCOPE)
def test_questions_about_the_disclosure_are_allowed(question: str) -> None:
    assert scan_question(question) == []
