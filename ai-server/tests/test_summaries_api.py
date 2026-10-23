from fastapi.testclient import TestClient

from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient
from app.main import create_app
from app.summary import fake
from app.summary.schema import SummaryRequest

CUR = "20260814000001"
BODY = {
    "companyName": "예시전자",
    "previousReport": "반기보고서 (2025.06)",
    "currentReport": "반기보고서 (2026.06)",
    "textItems": [
        {
            "ref": "T1",
            "changeType": "MODIFIED",
            "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
            "sources": [
                {
                    "evidenceId": f"{CUR}#B3",
                    "sectionPath": "II. 사업의 내용",
                    "text": "파운드리를 합니다.",
                }
            ],
        }
    ],
    "financialItems": [{"ref": "F1", "accountName": "매출액", "direction": "UP", "candidates": []}],
}


def app_with(provider: FakeProvider | None) -> TestClient:
    llm = LlmClient(provider, LlmSettings(provider="fake" if provider else ""))
    return TestClient(create_app(llm_client=llm))


def test_summary_items_and_call_records_are_returned() -> None:
    client = app_with(FakeProvider(responders={"summary": fake.respond}))

    response = client.post("/internal/summaries", json=BODY, headers={"X-Trace-Id": "sum-1"})

    assert response.status_code == 200
    data = response.json()
    assert data["promptVersion"] == "summary-1"
    assert data["expressionRulesVersion"] == "expr-1"
    assert data["model"] == "fake-model"
    t1, f1 = data["items"]
    assert t1 == {
        "ref": "T1",
        "kind": "TEXT",
        "status": "OK",
        "sentence": "'사업의 개요' 항목에 내용이 바뀌었어요.",
        "explanation": None,
        "evidenceIds": [f"{CUR}#B3"],
        "reviewReason": None,
        "blockedRules": [],
    }
    assert f1["kind"] == "FINANCIAL" and f1["explanation"] is None
    (call,) = data["calls"]
    assert call["task"] == "summary"
    assert call["traceId"] == "sum-1"
    assert call["promptVersion"] == "summary-1"


def test_no_llm_is_503() -> None:
    response = app_with(None).post("/internal/summaries", json=BODY)

    assert response.status_code == 503
    assert response.json()["code"] == "AI_LLM_UNAVAILABLE"


def test_account_aliases_are_read_and_default_to_empty() -> None:
    aliased = {"ref": "F2", "accountName": "영업손실", "accountAliases": ["영업손실", "영업이익"]}
    body = {**BODY, "financialItems": [*BODY["financialItems"], aliased]}

    revenue, operating = SummaryRequest.model_validate(body).to_input().financial_items

    assert revenue.account_aliases == []
    assert operating.account_aliases == ["영업손실", "영업이익"]


def test_duplicate_refs_are_rejected() -> None:
    body = {**BODY, "financialItems": [{"ref": "T1", "accountName": "매출액"}]}

    response = app_with(FakeProvider()).post("/internal/summaries", json=body)

    assert response.status_code == 400
