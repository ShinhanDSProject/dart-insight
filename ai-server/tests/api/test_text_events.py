import base64
import json
from typing import Any

from fastapi.testclient import TestClient

from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient, ProviderError
from app.main import create_app

PREVIOUS_RCEPT = "20250814003156"
CURRENT_RCEPT = "20260814003699"
CHANGE = {
    "changeNo": 12,
    "changeType": "MODIFIED",
    "blockType": "PARAGRAPH",
    "listGroup": "MAIN",
    "field": "LITIGATION",
    "raisedFromNote": False,
    "sectionPath": "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항",
    "previousBlockNo": 2028,
    "currentBlockNo": 1576,
    "previousText": "당사는 소송을 진행하고 있습니다.",
    "currentText": "당사는 소송에서 패소했습니다.",
    "changedUnitCount": 1,
}
BODY = {
    "previousRceptNo": PREVIOUS_RCEPT,
    "currentRceptNo": CURRENT_RCEPT,
    "equityTotal": 1000000000000,
    "currency": "KRW",
    "changes": [CHANGE, CHANGE | {"changeNo": 13, "currentBlockNo": 1577}],
}
EVENT = {
    "title": "소송 패소",
    "kind": "소송",
    "changeNos": [12],
    "quotes": [
        {"changeNo": 12, "purpose": "CHANGE", "side": "PREVIOUS", "text": "소송을 진행하고"},
        {"changeNo": 12, "purpose": "CHANGE", "side": "CURRENT", "text": "소송에서 패소했습니다"},
    ],
}


class ScriptedProvider(FakeProvider):
    name = "scripted"


def app_with(*script: Any) -> TestClient:
    provider = ScriptedProvider(script=script, model="scripted-model")
    settings = LlmSettings(provider="scripted", max_retries=0, max_output_retries=2)
    return TestClient(create_app(llm_client=LlmClient(provider, settings, sleep=lambda _: None)))


def post(client: TestClient, body: dict[str, Any] = BODY) -> Any:
    return client.post("/internal/text-events", json=body, headers={"X-Trace-Id": "evt-1"})


def decoded_calls(response: Any) -> list[dict[str, Any]]:
    return json.loads(base64.urlsafe_b64decode(response.headers["X-Llm-Calls"]))


def test_event_scale_and_order_are_filled_by_code_in_the_response() -> None:
    small = CHANGE | {
        "changeNo": 12,
        "currentText": "당사는 소송에서 패소했습니다. 배상금은 100억원입니다.",
    }
    large = CHANGE | {
        "changeNo": 13,
        "currentBlockNo": 1577,
        "currentText": "당사는 공장을 매각했습니다. 매각금액은 3,000억원입니다.",
    }
    second = {
        "title": "공장 매각",
        "kind": "자산 매각",
        "changeNos": [13],
        "quotes": [{"changeNo": 13, "purpose": "CHANGE", "side": "CURRENT", "text": "공장을 매각"}],
    }
    first = EVENT | {
        "quotes": [
            {"changeNo": 12, "purpose": "CHANGE", "side": "CURRENT", "text": "소송에서 패소"}
        ]
    }

    response = post(
        app_with({"events": [first, second]}, {"choice": 1}, {"choice": 1}),
        BODY | {"changes": [small, large]},
    )

    assert response.status_code == 200
    events = response.json()["events"]
    assert [(e["sortOrder"], e["title"]) for e in events] == [(1, "공장 매각"), (2, "소송 패소")]
    assert events[0]["scaleAmount"] == 300000000000
    assert events[0]["scaleAmountKrw"] == 300000000000
    assert events[0]["scaleAmountText"] == "3,000억원"
    assert events[0]["currency"] == "KRW"
    assert events[0]["scaleRatio"] == 0.3
    assert events[0]["scaleEvidenceId"] == f"{CURRENT_RCEPT}#B1577"
    assert events[0]["amountSource"] == "ai_choice"
    assert events[0]["sortBasis"] == "AMOUNT"


def test_change_without_unit_count_is_rejected_as_invalid_input() -> None:
    change = {k: v for k, v in CHANGE.items() if k != "changedUnitCount"}

    response = post(app_with({"events": [EVENT]}), BODY | {"changes": [change]})

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_events_are_returned_in_spec_shape() -> None:
    response = post(app_with({"events": [EVENT]}))

    assert response.status_code == 200
    data = response.json()
    assert data["created"] is True
    assert data["notCreatedReason"] is None
    assert data["model"] == "scripted-model"
    assert data["promptVersion"] == "text-event-2"
    assert data["generatedAt"] is not None
    assert data["droppedEventCount"] == 0
    assert data["events"] == [
        {
            "sortOrder": 1,
            "title": "소송 패소",
            "kind": "소송",
            "changeNos": [12],
            "quotes": [
                {
                    "changeNo": 12,
                    "purpose": "CHANGE",
                    "side": "PREVIOUS",
                    "text": "소송을 진행하고",
                    "evidenceId": f"{PREVIOUS_RCEPT}#B2028",
                },
                {
                    "changeNo": 12,
                    "purpose": "CHANGE",
                    "side": "CURRENT",
                    "text": "소송에서 패소했습니다",
                    "evidenceId": f"{CURRENT_RCEPT}#B1576",
                },
            ],
            "scaleAmount": None,
            "scaleAmountText": None,
            "currency": None,
            "scaleAmountKrw": None,
            "scaleRatio": None,
            "scaleNotComputedReason": None,
            "scaleEvidenceId": None,
            "amountSource": "none",
            "fxSource": None,
            "fxRateDate": None,
            "sortBasis": "UNIT_COUNT",
        }
    ]
    assert data["unboundChangeNos"] == [13]
    (call,) = data["calls"]
    assert call["task"] == "text_event"
    assert call["promptVersion"] == "text-event-2"
    assert call["traceId"] == "evt-1"
    assert call["outcome"] == "OK"


def test_fake_provider_is_reported_as_not_created() -> None:
    llm = LlmClient(FakeProvider(), LlmSettings(provider="fake"))

    response = post(TestClient(create_app(llm_client=llm)))

    assert response.status_code == 200
    data = response.json()
    assert data["created"] is False
    assert data["notCreatedReason"] == "FAKE_MODEL"
    assert data["model"] is None
    assert data["promptVersion"] == "text-event-2"
    assert data["events"] == []
    assert data["calls"] == []


def test_no_candidates_is_reported_as_not_created() -> None:
    response = post(app_with(), BODY | {"changes": []})

    assert response.status_code == 200
    assert response.json()["notCreatedReason"] == "NO_CANDIDATES"


def test_dropped_event_is_counted() -> None:
    broken = {"events": [EVENT, EVENT | {"title": "1,500억원 패소", "changeNos": [12]}]}

    response = post(app_with(broken, broken, broken))

    assert response.status_code == 200
    data = response.json()
    assert data["droppedEventCount"] == 1
    assert len(data["events"]) == 1
    assert [c["outcome"] for c in data["calls"]] == ["INVALID_OUTPUT"] * 3


def test_no_usable_event_is_502_with_call_records_in_header() -> None:
    broken = {"events": [EVENT | {"title": "지금 매수 추천"}]}

    response = post(app_with(broken, broken, broken))

    assert response.status_code == 502
    body = response.json()
    assert body["code"] == "AI_EVENTS_INVALID_OUTPUT"
    assert body["traceId"] == "evt-1"
    assert "매수" not in body["message"]
    assert [c["outcome"] for c in decoded_calls(response)] == ["INVALID_OUTPUT"] * 3


def test_llm_unavailable_is_503_with_call_records_in_header() -> None:
    response = post(app_with(ProviderError("인증 실패")))

    assert response.status_code == 503
    assert response.json()["code"] == "AI_LLM_UNAVAILABLE"
    assert [c["outcome"] for c in decoded_calls(response)] == ["ERROR"]


def test_missing_field_is_400() -> None:
    body = {k: v for k, v in BODY.items() if k != "currentRceptNo"}

    response = post(app_with(), body)

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_duplicate_change_no_is_400() -> None:
    response = post(app_with(), BODY | {"changes": [CHANGE, CHANGE]})

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_null_equity_total_is_accepted() -> None:
    response = post(app_with({"events": []}), BODY | {"equityTotal": None, "currency": None})

    assert response.status_code == 200
