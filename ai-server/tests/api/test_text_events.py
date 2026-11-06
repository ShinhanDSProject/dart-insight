import base64
import json
from typing import Any

from fastapi.testclient import TestClient

from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient, LlmRequest, ProviderError
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
    "changeNos": [12],
    "quotes": [
        {"changeNo": 12, "purpose": "CHANGE", "side": "PREVIOUS", "text": "소송을 진행하고"},
        {"changeNo": 12, "purpose": "CHANGE", "side": "CURRENT", "text": "소송에서 패소했습니다"},
    ],
    "signalKind": "LITIGATION",
    "signalChange": "LOST",
    "signalChangeNo": 12,
    "signalSide": "CURRENT",
}


class ScriptedProvider(FakeProvider):
    name = "scripted"


def meaning(request: LlmRequest) -> dict[str, Any]:
    """공시의 의미 호출의 통과하는 답. 정해 둔 응답(script)을 다 쓴 뒤에 쓰인다."""
    evidence = request.context[0].evidence_id
    item = {
        "type": "FACT",
        "absentTopics": [],
        "text": "소송에서 졌어요.",
        "evidenceIds": [evidence],
    }
    return {"items": [item]}


def reasons(request: LlmRequest) -> dict[str, Any]:
    """신호 이유 호출의 통과하는 답(근거 2개)."""
    evidence = request.context[0].evidence_id
    item = {"type": "REASON", "text": "회사가 소송에서 졌어요.", "evidenceIds": [evidence]}
    return {"items": [item, item]}


def app_with(*script: Any, **responders: Any) -> TestClient:
    """문장 호출은 동시에 돌아 script의 차례가 섞이므로, 문장 응답은 task별 responders로 준다."""
    tasks = {"event_meaning": meaning, "event_signal_reason": reasons} | responders
    provider = ScriptedProvider(script=script, responders=tasks, model="scripted-model")
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
    assert data["promptVersion"] == "text-event-4"
    assert data["generatedAt"] is not None
    assert data["signalTableVersion"] == "signal-table-2"
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
            "kindCode": "LITIGATION",
            "changeCode": "LOST",
            "changeName": "패소",
            "signal": "CAUTION",
            "holdReason": None,
            "signalEvidenceId": f"{CURRENT_RCEPT}#B1576",
            "rowCounts": None,
            "factAccounts": [],
            "meaning": {
                "status": "GENERATED",
                "failReason": None,
                "items": [
                    {
                        "type": "FACT",
                        "absentTopics": [],
                        "text": "소송에서 졌어요.",
                        "evidenceIds": [f"{PREVIOUS_RCEPT}#B2028"],
                    }
                ],
                "model": "scripted-model",
                "promptVersion": "event-meaning-1",
                "generatedAt": data["events"][0]["meaning"]["generatedAt"],
            },
            "signalReason": {
                "status": "GENERATED",
                "failReason": None,
                "items": [
                    {
                        "type": "REASON",
                        "text": "회사가 소송에서 졌어요.",
                        "evidenceIds": [f"{PREVIOUS_RCEPT}#B2028"],
                    }
                ]
                * 2,
                "model": "scripted-model",
                "promptVersion": "event-signal-reason-1",
                "generatedAt": data["events"][0]["signalReason"]["generatedAt"],
            },
            "glossary": [],
        }
    ]
    assert data["events"][0]["meaning"]["generatedAt"] is not None
    assert data["unboundChangeNos"] == [13]
    grouping, meaning_call, reason_call = data["calls"]
    assert grouping["task"] == "text_event"
    assert grouping["promptVersion"] == "text-event-4"
    assert grouping["traceId"] == "evt-1"
    assert grouping["outcome"] == "OK"
    assert meaning_call["task"] == "event_meaning"
    assert meaning_call["traceId"] == "evt-1"
    assert reason_call["task"] == "event_signal_reason"


def test_fake_provider_is_reported_as_not_created() -> None:
    llm = LlmClient(FakeProvider(), LlmSettings(provider="fake"))

    response = post(TestClient(create_app(llm_client=llm)))

    assert response.status_code == 200
    data = response.json()
    assert data["created"] is False
    assert data["notCreatedReason"] == "FAKE_MODEL"
    assert data["model"] is None
    assert data["promptVersion"] == "text-event-4"
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
    assert [c["outcome"] for c in data["calls"]] == ["INVALID_OUTPUT"] * 3 + ["OK", "OK"]


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


def test_litigation_table_with_several_changed_rows_is_held_and_rows_are_returned() -> None:
    table = CHANGE | {"blockType": "TABLE", "rowCounts": {"changed": 1, "added": 2, "missing": 0}}

    response = post(app_with({"events": [EVENT]}), BODY | {"changes": [table]})

    assert response.status_code == 200
    (event,) = response.json()["events"]
    assert (event["signal"], event["holdReason"]) == ("HOLD", "MIXED_LITIGATION")
    assert event["rowCounts"] == {"changed": 1, "added": 2, "missing": 0}


def test_negative_row_count_is_400() -> None:
    table = CHANGE | {"rowCounts": {"changed": -1, "added": 0, "missing": 0}}

    response = post(app_with(), BODY | {"changes": [table]})

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_fact_accounts_of_the_picked_kind_are_returned() -> None:
    treasury = EVENT | {"signalKind": "TREASURY_STOCK", "signalChange": "RETIRED"}

    response = post(app_with({"events": [treasury]}))

    (event,) = response.json()["events"]
    assert event["kind"] == "자기주식"
    assert event["factAccounts"] == [{"accountType": None, "accountName": "자기주식"}]


def test_signal_table_is_returned_without_unconfirmed_terms() -> None:
    response = TestClient(create_app()).get("/internal/signal-tables/current")

    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "signal-table-2"
    assert "투자 판단이 아니" in data["signalNotice"]
    assert len(data["kinds"]) == 30
    assert data["glossary"] == []


def test_meaning_that_keeps_failing_is_returned_as_failed_without_sentences() -> None:
    bad = {"items": [{"type": "FACT", "absentTopics": [], "text": "목표주가가 올라요."}]}

    response = post(app_with({"events": [EVENT]}, event_meaning=lambda _: bad))

    assert response.status_code == 200
    (event,) = response.json()["events"]
    assert event["meaning"]["status"] == "FAILED"
    assert event["meaning"]["failReason"] == "INVALID_OUTPUT"
    assert event["meaning"]["items"] == []
    assert event["meaning"]["promptVersion"] == "event-meaning-1"


def test_signal_reason_that_keeps_failing_falls_back_to_the_general_phrase() -> None:
    bad = {"items": [{"type": "REASON", "text": "지금 매도하세요.", "evidenceIds": []}]}

    response = post(app_with({"events": [EVENT]}, event_signal_reason=lambda _: bad))

    assert response.status_code == 200
    (event,) = response.json()["events"]
    reason = event["signalReason"]
    assert (reason["status"], reason["failReason"]) == ("FALLBACK", "INVALID_OUTPUT")
    assert reason["items"] == [
        {
            "type": "GENERAL",
            "text": "판결이 확정되면 회사가 배상금이나 비용을 내야 할 수 있어요.",
            "evidenceIds": [],
        }
    ]


def test_hold_without_criteria_has_no_signal_reason() -> None:
    other = EVENT | {"signalKind": "NOT_A_KIND"}

    response = post(app_with({"events": [other]}))

    (event,) = response.json()["events"]
    assert (event["signal"], event["holdReason"]) == ("HOLD", "NO_CRITERIA")
    assert event["signalReason"] is None
    assert [c["task"] for c in response.json()["calls"]] == ["text_event", "event_meaning"]
