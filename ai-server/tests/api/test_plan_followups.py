from fastapi.testclient import TestClient

from app.core.config import LlmSettings
from app.followup import fake
from app.llm import FakeProvider, LlmClient
from app.main import create_app

CUR = "20260310000123"
CANDIDATE = {
    "evidenceId": f"{CUR}#B310",
    "sectionPath": "II. 사업의 내용 > 3. 원재료 및 생산설비",
    "text": "평택 신규 라인은 증설 공사를 진행 중입니다.",
}
PLAN = {
    "planId": "P1",
    "category": "INVESTMENT",
    "summary": "평택 라인 증설 계획을 밝혔어요.",
    "quote": "평택 라인을 증설할 계획입니다.",
    "candidates": [CANDIDATE],
}
BODY = {
    "promptVersion": "plan-followup-1",
    "companyName": "예시전자",
    "previousReportName": "사업보고서 (2024.12)",
    "currentReportName": "사업보고서 (2025.12)",
    "plans": [PLAN, {**PLAN, "planId": "P2", "category": "FINANCIAL", "candidates": []}],
}


def app_with(provider: FakeProvider | None) -> TestClient:
    llm = LlmClient(provider, LlmSettings(provider="fake" if provider else ""))
    return TestClient(create_app(llm_client=llm))


def test_followups_and_call_records_are_returned() -> None:
    client = app_with(FakeProvider(responders={"plan_followup": fake.respond}))

    response = client.post("/internal/plan-followups", json=BODY, headers={"X-Trace-Id": "pf-1"})

    assert response.status_code == 200
    data = response.json()
    assert data["promptVersion"] == "plan-followup-1"
    assert data["expressionRulesVersion"] == "expr-1"
    assert data["model"] == "fake-model"
    assert data["status"] == "GENERATED"
    assert data["followups"] == [
        {
            "planId": "P1",
            "status": "MENTIONED",
            "summary": fake.MENTIONED_SUMMARY,
            "quote": "평택 신규 라인은 증설 공사를 진행 중입니다.",
            "evidenceIds": [f"{CUR}#B310"],
        },
        {"planId": "P2", "status": "NOT_FOUND", "summary": None, "quote": None, "evidenceIds": []},
    ]
    assert data["reviewReason"] is None
    (call,) = data["calls"]
    assert call["task"] == "plan_followup"
    assert call["traceId"] == "pf-1"


def test_prompt_version_mismatch_is_rejected_without_llm_call() -> None:
    provider = FakeProvider(responders={"plan_followup": fake.respond})

    response = app_with(provider).post(
        "/internal/plan-followups", json={**BODY, "promptVersion": "plan-followup-0"}
    )

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"
    assert provider.requests == []


def test_bad_plans_are_rejected() -> None:
    client = app_with(FakeProvider(responders={"plan_followup": fake.respond}))
    many = [{**PLAN, "planId": f"P{n}"} for n in range(11)]
    four = [{**CANDIDATE, "evidenceId": f"{CUR}#B{n}"} for n in range(4)]

    for body in (
        {**BODY, "plans": []},
        {**BODY, "plans": many},
        {**BODY, "plans": [PLAN, PLAN]},
        {**BODY, "plans": [{**PLAN, "category": "MARKET"}]},
        {**BODY, "plans": [{**PLAN, "candidates": four}]},
        {**BODY, "plans": [{**PLAN, "candidates": [CANDIDATE, CANDIDATE]}]},
    ):
        response = client.post("/internal/plan-followups", json=body)
        assert response.status_code == 400
        assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_llm_unavailable_is_503() -> None:
    response = app_with(None).post("/internal/plan-followups", json=BODY)

    assert response.status_code == 503
    assert response.json()["code"] == "AI_LLM_UNAVAILABLE"
