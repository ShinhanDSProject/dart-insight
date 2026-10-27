from fastapi.testclient import TestClient

from app.briefing import fake
from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient
from app.main import create_app

RCEPT = "20260310000123"
SOURCE = {
    "evidenceId": f"{RCEPT}#B120",
    "topic": "OVERVIEW",
    "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
    "text": "당사는 반도체와 스마트폰을 만들어 판매합니다.",
}
BODY = {
    "promptVersion": "briefing-1",
    "companyName": "예시전자",
    "reportName": "사업보고서 (2025.12)",
    "sources": [SOURCE],
}


def app_with(provider: FakeProvider | None) -> TestClient:
    llm = LlmClient(provider, LlmSettings(provider="fake" if provider else ""))
    return TestClient(create_app(llm_client=llm))


def test_briefing_and_call_records_are_returned() -> None:
    client = app_with(FakeProvider(responders={"briefing": fake.respond}))

    response = client.post("/internal/briefings", json=BODY, headers={"X-Trace-Id": "brf-1"})

    assert response.status_code == 200
    data = response.json()
    assert data["promptVersion"] == "briefing-1"
    assert data["expressionRulesVersion"] == "expr-1"
    assert data["model"] == "fake-model"
    assert data["generatedAt"] is not None
    assert data["status"] == "GENERATED"
    assert data["sentences"] == [
        {
            "text": (
                "사업 개요: 원문에 '당사는 반도체와 스마트폰을 만들어 판매합니다.'"
                "라고 적혀 있어요."
            ),
            "evidenceIds": [f"{RCEPT}#B120"],
        }
    ]
    assert data["reviewReason"] is None
    assert data["blockedRules"] == []
    (call,) = data["calls"]
    assert call["task"] == "briefing"
    assert call["traceId"] == "brf-1"


def test_prompt_version_mismatch_is_rejected_without_llm_call() -> None:
    provider = FakeProvider(responders={"briefing": fake.respond})

    response = app_with(provider).post(
        "/internal/briefings", json={**BODY, "promptVersion": "briefing-0"}
    )

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"
    assert provider.requests == []


def test_empty_sources_duplicate_ids_and_unknown_topic_are_rejected() -> None:
    client = app_with(FakeProvider(responders={"briefing": fake.respond}))

    for body in (
        {**BODY, "sources": []},
        {**BODY, "sources": [SOURCE, SOURCE]},
        {**BODY, "sources": [{**SOURCE, "topic": "VALUATION"}]},
        {**BODY, "sources": [SOURCE] * 9},
    ):
        response = client.post("/internal/briefings", json=body)
        assert response.status_code == 400
        assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_llm_unavailable_is_503() -> None:
    response = app_with(None).post("/internal/briefings", json=BODY)

    assert response.status_code == 503
    assert response.json()["code"] == "AI_LLM_UNAVAILABLE"
