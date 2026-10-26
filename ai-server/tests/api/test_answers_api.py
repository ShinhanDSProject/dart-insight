from fastapi.testclient import TestClient

from app.answer import fake
from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient
from app.main import create_app

CUR = "20260814003699"
SOURCE = {
    "evidenceId": f"{CUR}#B812",
    "side": "current",
    "sectionPath": "IV. 이사의 경영진단 및 분석의견 > 2. 영업실적",
    "text": "매출액은 메모리 수요 회복으로 늘었습니다.",
}
BODY = {
    "companyName": "예시전자",
    "previousReport": "반기보고서 (2025.06)",
    "currentReport": "반기보고서 (2026.06)",
    "question": "매출액은 왜 늘었나요?",
    "facts": [
        {"ref": "F1", "sentence": "매출액이 153.7조 원에서 305.4조 원으로 늘었어요(+98.7%)."}
    ],
    "sources": [SOURCE],
}


def app_with(provider: FakeProvider | None) -> TestClient:
    llm = LlmClient(provider, LlmSettings(provider="fake" if provider else ""))
    return TestClient(create_app(llm_client=llm))


def test_answer_and_call_records_are_returned() -> None:
    client = app_with(FakeProvider(responders={"answer": fake.respond}))

    response = client.post("/internal/answers", json=BODY, headers={"X-Trace-Id": "ans-1"})

    assert response.status_code == 200
    data = response.json()
    assert data["promptVersion"] == "answer-2"
    assert data["expressionRulesVersion"] == "expr-1"
    assert data["model"] == "fake-model"
    assert data["generatedAt"] is not None
    assert data["status"] == "ANSWERED"
    assert data["answer"] == (
        f"관련 공시 내용으로 '매출액은 메모리 수요 회복으로 늘었습니다.'이 있어요[{CUR}#B812]."
    )
    assert data["evidenceIds"] == [f"{CUR}#B812"]
    assert data["factRefs"] == []
    assert data["reviewReason"] is None
    assert data["blockedRules"] == []
    (call,) = data["calls"]
    assert call["task"] == "answer"
    assert call["traceId"] == "ans-1"
    assert call["promptVersion"] == "answer-2"


def test_investment_question_is_out_of_scope_without_llm_call() -> None:
    provider = FakeProvider(responders={"answer": fake.respond})

    response = app_with(provider).post(
        "/internal/answers", json={**BODY, "question": "지금 사야 하나요?"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OUT_OF_SCOPE"
    assert data["answer"] is None
    assert data["model"] is None and data["generatedAt"] is None
    assert data["calls"] == []
    assert provider.requests == []


def test_nothing_to_cite_is_not_found_without_llm_call() -> None:
    provider = FakeProvider(responders={"answer": fake.respond})

    response = app_with(provider).post(
        "/internal/answers", json={**BODY, "facts": [], "sources": []}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "NOT_FOUND"
    assert response.json()["calls"] == []
    assert provider.requests == []


def test_duplicate_evidence_ids_are_400() -> None:
    body = {**BODY, "sources": [SOURCE, SOURCE]}

    response = app_with(FakeProvider()).post("/internal/answers", json=body)

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_duplicate_fact_refs_are_400() -> None:
    body = {**BODY, "facts": BODY["facts"] * 2}

    response = app_with(FakeProvider()).post("/internal/answers", json=body)

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_missing_question_is_400() -> None:
    body = {k: v for k, v in BODY.items() if k != "question"}

    response = app_with(FakeProvider()).post("/internal/answers", json=body)

    assert response.status_code == 400
    assert response.json()["errors"][0]["field"] == "question"


def test_one_report_question_without_previous_report_is_answered() -> None:
    body = {key: value for key, value in BODY.items() if key != "previousReport"}
    body["facts"] = []

    response = app_with(FakeProvider(responders={"answer": fake.respond})).post(
        "/internal/answers", json=body
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ANSWERED"
    assert data["evidenceIds"] == [f"{CUR}#B812"]


def test_investment_question_without_sources_is_out_of_scope() -> None:
    provider = FakeProvider(responders={"answer": fake.respond})
    body = {**BODY, "previousReport": None, "facts": [], "sources": []}

    response = app_with(provider).post(
        "/internal/answers", json={**body, "question": "목표주가는 얼마인가요?"}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "OUT_OF_SCOPE"
    assert response.json()["calls"] == []


def test_no_llm_is_503() -> None:
    response = app_with(None).post("/internal/answers", json=BODY)

    assert response.status_code == 503
    assert response.json()["code"] == "AI_LLM_UNAVAILABLE"
