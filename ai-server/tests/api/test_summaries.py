import base64
import json

from fastapi.testclient import TestClient

from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient
from app.llm.providers import ProviderError, ProviderTransientError
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
    "financialItems": [{"ref": "F1", "accountName": "매출액", "direction": "UP"}],
}


def app_with(provider: FakeProvider | None) -> TestClient:
    llm = LlmClient(provider, LlmSettings(provider="fake" if provider else ""))
    return TestClient(create_app(llm_client=llm))


def test_summary_items_and_call_records_are_returned() -> None:
    client = app_with(FakeProvider(responders={"summary": fake.respond}))

    response = client.post("/internal/summaries", json=BODY, headers={"X-Trace-Id": "sum-1"})

    assert response.status_code == 200
    data = response.json()
    assert data["promptVersion"] == "summary-3"
    assert data["expressionRulesVersion"] == "expr-1"
    assert data["gradeRulesVersion"] == "grade-2"
    assert data["model"] == "fake-model"
    t1, f1 = data["items"]
    assert t1 == {
        "ref": "T1",
        "kind": "TEXT",
        "status": "OK",
        "sentence": "'사업의 개요' 항목에 내용이 바뀌었어요.",
        "explanation": None,
        "grade": None,
        "quote": None,
        "quoteEvidenceId": None,
        "evidenceIds": [f"{CUR}#B3"],
        "reviewReason": None,
        "blockedRules": [],
    }
    assert f1["kind"] == "FINANCIAL" and f1["explanation"] is None
    assert f1["grade"] == "NONE"  # 후보 원문이 없어 LLM에 묻지 않았다
    (call,) = data["calls"]
    assert call["task"] == "summary"
    assert call["traceId"] == "sum-1"
    assert call["promptVersion"] == "summary-3"


def test_financial_candidates_are_searched_in_the_document_blocks() -> None:
    client = app_with(FakeProvider(responders={"summary": fake.respond}))
    mdna = "IV. 이사의 경영진단 및 분석의견 > 2. 영업실적"
    body = {
        **BODY,
        "textItems": [],
        "financialItems": [
            {"ref": "F1", "accountName": "매출액", "accountAliases": ["매출액"]},
            {"ref": "F2", "accountName": "자산총계", "accountAliases": ["자산총계"]},
        ],
        "documentBlocks": [
            {
                "evidenceId": f"{CUR}#B5",
                "sectionPath": "II. 사업의 내용",
                "text": "(3) 판매경로별 매출액 비중",
            },
            {
                "evidenceId": f"{CUR}#B9",
                "sectionPath": mdna,
                "text": "매출액은 메모리 수요 회복으로 전년 대비 증가하였습니다. "
                "주요 제품의 판매량과 판매 가격이 함께 올랐습니다.",
            },
        ],
    }

    data = client.post("/internal/summaries", json=body).json()

    revenue, assets = data["items"]
    assert revenue["grade"] == "STATED"
    assert revenue["quoteEvidenceId"] == f"{CUR}#B9"  # 짧은 제목 줄(B5)은 후보가 아니다
    assert revenue["evidenceIds"] == [f"{CUR}#B9"]
    assert assets["grade"] == "NONE" and assets["explanation"] is None


def test_no_candidate_anywhere_does_not_call_the_llm() -> None:
    body = {
        **BODY,
        "textItems": [],
        "financialItems": [{"ref": "F1", "accountName": "매출액", "accountAliases": ["매출액"]}],
        "documentBlocks": [
            {
                "evidenceId": f"{CUR}#B1",
                "sectionPath": "II. 사업의 내용",
                "text": "당사는 메모리 반도체를 만들어 판매합니다.",
            }
        ],
    }

    data = (
        app_with(FakeProvider(responders={"summary": fake.respond}))
        .post("/internal/summaries", json=body)
        .json()
    )

    assert data["items"][0]["grade"] == "NONE"
    assert data["calls"] == []


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


def test_no_llm_without_calls_has_no_call_header() -> None:
    response = app_with(None).post("/internal/summaries", json=BODY)

    assert "x-llm-calls" not in response.headers
    assert set(response.json()) == {"code", "message", "traceId", "errors"}


def test_unavailable_llm_returns_the_calls_so_far_in_a_header() -> None:
    # 일시 오류로 한 번 다시 시도한 뒤 인증 오류로 LLM을 더 부를 수 없음(#137, ADR-0042)
    provider = FakeProvider(
        script=[ProviderTransientError("시간 초과"), ProviderError("인증 실패")]
    )
    llm = LlmClient(provider, LlmSettings(provider="fake"), sleep=lambda _: None)
    client = TestClient(create_app(llm_client=llm))

    response = client.post("/internal/summaries", json=BODY, headers={"X-Trace-Id": "sum-fail"})

    assert response.status_code == 503
    body = response.json()
    assert body["code"] == "AI_LLM_UNAVAILABLE"
    assert set(body) == {"code", "message", "traceId", "errors"}
    calls = json.loads(base64.urlsafe_b64decode(response.headers["X-Llm-Calls"]).decode("utf-8"))
    assert [c["outcome"] for c in calls] == ["TRANSIENT_ERROR", "ERROR"]
    assert [c["attempt"] for c in calls] == [1, 2]
    assert all(c["task"] == "summary" and c["traceId"] == "sum-fail" for c in calls)
    assert "인증 실패" in calls[1]["error"]
