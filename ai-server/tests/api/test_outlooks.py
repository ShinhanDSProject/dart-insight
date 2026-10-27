from fastapi.testclient import TestClient

from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient
from app.main import create_app
from app.outlook import fake

RCEPT = "20260310000123"
SOURCE = {
    "evidenceId": f"{RCEPT}#B310",
    "sectionPath": "II. 사업의 내용 > 3. 원재료 및 생산설비",
    "text": "당사는 평택 신규 라인 증설을 2026년까지 완료할 계획입니다.",
}
BODY = {
    "promptVersion": "outlook-1",
    "companyName": "예시전자",
    "reportName": "사업보고서 (2025.12)",
    "sources": [SOURCE],
}


def app_with(provider: FakeProvider | None) -> TestClient:
    llm = LlmClient(provider, LlmSettings(provider="fake" if provider else ""))
    return TestClient(create_app(llm_client=llm))


def test_outlook_items_and_call_records_are_returned() -> None:
    client = app_with(FakeProvider(responders={"outlook": fake.respond}))

    response = client.post("/internal/outlooks", json=BODY, headers={"X-Trace-Id": "out-1"})

    assert response.status_code == 200
    data = response.json()
    assert data["promptVersion"] == "outlook-1"
    assert data["expressionRulesVersion"] == "expr-1"
    assert data["model"] == "fake-model"
    assert data["generatedAt"] is not None
    assert data["status"] == "GENERATED"
    assert data["items"] == [
        {
            "category": "INVESTMENT",
            "summary": fake.SUMMARY,
            "quote": "당사는 평택 신규 라인 증설을 2026년까지 완료할 계획입니다.",
            "evidenceIds": [f"{RCEPT}#B310"],
        }
    ]
    assert data["reviewReason"] is None
    assert data["blockedRules"] == []
    (call,) = data["calls"]
    assert call["task"] == "outlook"
    assert call["traceId"] == "out-1"


def test_no_plan_sentence_is_empty() -> None:
    client = app_with(FakeProvider(responders={"outlook": fake.respond}))
    body = {**BODY, "sources": [{**SOURCE, "text": "당기 원재료 매입액은 전기와 비슷했습니다."}]}

    response = client.post("/internal/outlooks", json=body)

    assert response.status_code == 200
    assert response.json()["status"] == "EMPTY"
    assert response.json()["items"] == []


def test_prompt_version_mismatch_is_rejected_without_llm_call() -> None:
    provider = FakeProvider(responders={"outlook": fake.respond})

    response = app_with(provider).post(
        "/internal/outlooks", json={**BODY, "promptVersion": "outlook-0"}
    )

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"
    assert provider.requests == []


def test_empty_too_many_and_duplicate_sources_are_rejected() -> None:
    client = app_with(FakeProvider(responders={"outlook": fake.respond}))
    many = [{**SOURCE, "evidenceId": f"{RCEPT}#B{n}"} for n in range(13)]

    for body in (
        {**BODY, "sources": []},
        {**BODY, "sources": [SOURCE, SOURCE]},
        {**BODY, "sources": many},
    ):
        response = client.post("/internal/outlooks", json=body)
        assert response.status_code == 400
        assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_llm_unavailable_is_503() -> None:
    response = app_with(None).post("/internal/outlooks", json=BODY)

    assert response.status_code == 503
    assert response.json()["code"] == "AI_LLM_UNAVAILABLE"
