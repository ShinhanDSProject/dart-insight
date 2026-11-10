from fastapi.testclient import TestClient

from app.activity import fake
from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient
from app.main import create_app

PREV = "20250814003156"
CUR = "20260814003699"
CHANGE = {
    "changeNo": 7,
    "changeType": "ADDED",
    "blockType": "PARAGRAPH",
    "listGroup": "MAIN",
    "field": "CONTRACT",
    "raisedFromNote": False,
    "sectionPath": "II. 사업의 내용 > 6. 주요계약 및 연구개발활동",
    "previousEvidenceId": None,
    "currentEvidenceId": f"{CUR}#B174",
    "previousText": None,
    "currentText": "당사는 Tesla와 파운드리 공급계약을 체결하였습니다.",
}
# 후보 규칙(ADR-0051)에 맞지 않는 변경: 분야 없는 문단 수정
NOT_CANDIDATE = {
    **CHANGE,
    "changeNo": 8,
    "changeType": "MODIFIED",
    "field": "OTHER",
    "sectionPath": "I. 회사의 개요",
    "previousEvidenceId": f"{PREV}#B3",
    "currentEvidenceId": f"{CUR}#B3",
    "previousText": "본점 소재지는 수원시입니다.",
    "currentText": "본점 소재지는 경기도 수원시입니다.",
}
BODY = {
    "promptVersion": "period-activity-1",
    "companyName": "예시전자",
    "previousReportName": "반기보고서 (2025.06)",
    "currentReportName": "반기보고서 (2026.06)",
    "changes": [CHANGE, NOT_CANDIDATE],
}


def app_with(provider: FakeProvider | None) -> TestClient:
    llm = LlmClient(provider, LlmSettings(provider="fake" if provider else ""))
    return TestClient(create_app(llm_client=llm))


def test_activities_are_returned_from_candidate_changes_only() -> None:
    client = app_with(FakeProvider(responders={"period_activity": fake.respond}))

    response = client.post("/internal/period-activities", json=BODY)

    assert response.status_code == 200
    data = response.json()
    assert data["promptVersion"] == "period-activity-1"
    assert data["expressionRulesVersion"] == "expr-1"
    assert data["signalTableVersion"].startswith("signal-table-")
    assert data["status"] == "GENERATED"
    (item,) = data["items"]
    assert item["changeNos"] == [7]
    assert item["signal"] == "HOLD"
    assert item["facts"] == [
        {"quote": "당사는 Tesla와 파운드리 공급계약을 체결하였습니다.", "evidenceId": f"{CUR}#B174"}
    ]
    assert item["impacts"][0]["kind"] == "CHECK"
    assert data["candidateCount"] == 1
    assert data["calls"][0]["task"] == "period_activity"


def test_no_candidates_is_empty_without_llm_call() -> None:
    client = app_with(FakeProvider(responders={"period_activity": fake.respond}))

    response = client.post("/internal/period-activities", json={**BODY, "changes": [NOT_CANDIDATE]})

    assert response.status_code == 200
    assert response.json()["status"] == "EMPTY"
    assert response.json()["calls"] == []


def test_wrong_prompt_version_is_400() -> None:
    client = app_with(FakeProvider(responders={"period_activity": fake.respond}))

    response = client.post("/internal/period-activities", json={**BODY, "promptVersion": "x"})

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_llm_unavailable_is_503() -> None:
    client = app_with(None)

    response = client.post("/internal/period-activities", json=BODY)

    assert response.status_code == 503
    assert response.json()["code"] == "AI_LLM_UNAVAILABLE"
