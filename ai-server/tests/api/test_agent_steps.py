import base64
import json

from fastapi.testclient import TestClient

from app.agent import fake
from app.agent.prompt import PROMPT_VERSION
from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient, ProviderError
from app.main import create_app

TOOL = {
    "name": "get_summary",
    "description": "저장된 요약",
    "parameters": {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    },
}
RESULT = {
    "callId": "c1",
    "name": "get_summary",
    "arguments": {},
    "ok": True,
    "items": [{"evidenceId": "F4221", "text": "영업이익이 6.6조 원에서 4.3조 원으로 줄었어요."}],
}
BODY = {
    "companyName": "예시전자",
    "previousReport": "반기보고서 (2025.06)",
    "currentReport": "반기보고서 (2026.06)",
    "message": "영업이익 어디 있어?",
    "history": [{"role": "user", "text": "안녕"}],
    "context": {"tab": "financial"},
    "tools": [TOOL],
    "actions": [],
    "toolResults": [],
    "remainingSteps": 4,
}


def app_with(provider: FakeProvider | None) -> TestClient:
    llm = LlmClient(provider, LlmSettings(provider="fake" if provider else ""))
    return TestClient(create_app(llm_client=llm))


def fake_provider(*script: object) -> FakeProvider:
    return FakeProvider(
        script=script,
        responders={"agent_plan": fake.respond_plan, "agent_answer": fake.respond_answer},
    )


def test_first_step_returns_tool_calls() -> None:
    response = app_with(fake_provider()).post(
        "/internal/agent-steps", json=BODY, headers={"X-Trace-Id": "agent-1"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "TOOL_CALLS"
    assert data["toolCalls"] == [{"callId": "c1", "name": "get_summary", "arguments": {}}]
    assert data["final"] is None
    assert data["promptVersion"] == PROMPT_VERSION
    assert data["expressionRulesVersion"] == "expr-1"
    (call,) = data["calls"]
    assert (call["task"], call["traceId"]) == ("agent_plan", "agent-1")


def test_final_answer_shape() -> None:
    body = {**BODY, "toolResults": [RESULT]}

    data = app_with(fake_provider()).post("/internal/agent-steps", json=body).json()

    assert data["type"] == "FINAL"
    assert data["toolCalls"] == []
    final = data["final"]
    assert final["status"] == "ANSWERED"
    assert final["evidenceIds"] == ["F4221"]
    assert final["format"] == "CHAT"
    assert final["crossCheck"] is None
    assert final["blockedRules"] == []
    assert data["rejections"] == []


def test_out_of_scope_has_no_final_and_no_calls() -> None:
    body = {**BODY, "message": "목표주가 알려줘"}

    data = app_with(fake_provider()).post("/internal/agent-steps", json=body).json()

    assert data["type"] == "OUT_OF_SCOPE"
    assert data["final"] is None
    assert data["calls"] == []
    assert data["model"] is None


def test_result_of_unknown_tool_is_invalid_input() -> None:
    body = {**BODY, "toolResults": [{**RESULT, "name": "delete_note"}]}

    response = app_with(fake_provider()).post("/internal/agent-steps", json=body)

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_empty_tools_and_negative_steps_are_invalid_input() -> None:
    client = app_with(fake_provider())

    assert client.post("/internal/agent-steps", json={**BODY, "tools": []}).status_code == 400
    negative = client.post("/internal/agent-steps", json={**BODY, "remainingSteps": -1})
    assert negative.status_code == 400


def test_more_than_six_history_turns_is_invalid_input() -> None:
    body = {**BODY, "history": [{"role": "user", "text": "질문"}] * 7}

    assert app_with(fake_provider()).post("/internal/agent-steps", json=body).status_code == 400


def test_unavailable_llm_returns_503_with_call_records_header() -> None:
    body = {**BODY, "toolResults": [RESULT]}
    provider = fake_provider({"decision": "ANSWER", "toolCalls": []}, ProviderError("인증 실패"))

    response = app_with(provider).post("/internal/agent-steps", json=body)

    assert response.status_code == 503
    assert response.json()["code"] == "AI_LLM_UNAVAILABLE"
    calls = json.loads(base64.urlsafe_b64decode(response.headers["X-Llm-Calls"]))
    assert [c["task"] for c in calls] == ["agent_plan", "agent_answer"]


def test_fields_outside_the_contract_never_reach_the_prompt() -> None:
    provider = fake_provider()
    body = {**BODY, "userEmail": "someone@example.com", "nickname": "닉네임"}

    response = app_with(provider).post("/internal/agent-steps", json=body)

    assert response.status_code == 200
    (request,) = provider.requests
    assert "someone@example.com" not in request.user + request.system
    assert "닉네임" not in request.user + request.system


def test_invalid_tool_parameters_schema_is_invalid_input() -> None:
    broken = {**TOOL, "parameters": {"type": "object", "properties": {"q": {"type": "strng"}}}}
    not_object = {**TOOL, "parameters": {"type": "array"}}
    client = app_with(fake_provider())

    assert client.post("/internal/agent-steps", json={**BODY, "tools": [broken]}).status_code == 400
    assert (
        client.post("/internal/agent-steps", json={**BODY, "tools": [not_object]}).status_code
        == 400
    )
