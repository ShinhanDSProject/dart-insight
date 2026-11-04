"""MCP 서버 도구가 backend 공개 API를 맞게 부르는지 확인한다.

과금 정보·출처를 붙이고, 실패는 과금 없이 알린다.
"""

import asyncio
import json

import httpx
import pytest
from mcp.server.mcpserver.exceptions import ToolError

from dart_insight_mcp.api import DartInsightApi
from dart_insight_mcp.server import create_server


def server_with(handler):
    seen: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    api = DartInsightApi(base_url="http://backend.test", transport=httpx.MockTransport(record))
    return create_server(api), seen


def call(server, name, args):
    result = asyncio.run(server.call_tool(name, args))
    return result


def payload(result) -> dict:
    return json.loads(result.content[0].text)


def test_lists_six_read_only_tools_with_credit_hint_in_description():
    server, _ = server_with(lambda r: httpx.Response(200, json={}))
    tools = asyncio.run(server.list_tools())
    names = sorted(t.name for t in tools)
    assert names == sorted([
        "search_companies",
        "list_reports",
        "list_company_analyses",
        "get_analysis_summary",
        "list_text_changes",
        "list_financial_changes",
    ])
    assert all("크레딧 가설" in (t.description or "") for t in tools)


def test_search_companies_calls_public_api_and_adds_billing_and_notice():
    server, seen = server_with(
        lambda r: httpx.Response(
            200, json={"items": [{"corpCode": "00126380", "corpName": "삼성전자"}]}
        )
    )
    body = payload(call(server, "search_companies", {"query": "삼성전자"}))
    assert seen[0].url.path == "/api/companies"
    assert seen[0].url.params["query"] == "삼성전자"
    assert seen[0].headers["X-Trace-Id"].startswith("mcp-")
    assert body["data"]["items"][0]["corpCode"] == "00126380"
    assert body["billing"] == {
        "tool": "search_companies",
        "creditsHypothesis": 0,
        "charged": 0,
        "note": body["billing"]["note"],
    }
    assert "투자 조언이 아니며" in body["notice"]


def test_text_changes_sorts_by_priority_filters_risk_and_caps_size():
    server, seen = server_with(lambda r: httpx.Response(200, json={"items": []}))
    body = payload(
        call(
            server,
            "list_text_changes",
            {"analysis_id": 14, "risk_only": True, "change_type": "DELETED", "size": 500},
        )
    )
    params = seen[0].url.params
    assert seen[0].url.path == "/api/analyses/14/text-changes"
    assert (params["sort"], params["risk"], params["type"], params["size"]) == (
        "priority",
        "true",
        "DELETED",
        "50",
    )
    assert body["billing"]["creditsHypothesis"] == 1


def test_omits_risk_filter_when_not_asked_and_encodes_path_values():
    server, seen = server_with(lambda r: httpx.Response(200, json={"items": []}))
    call(server, "list_text_changes", {"analysis_id": 7})
    assert "risk" not in seen[0].url.params
    call(server, "list_reports", {"corp_code": "00/12"})
    assert seen[1].url.raw_path.decode().startswith("/api/companies/00%2F12/reports")


def test_backend_error_becomes_tool_error_with_code_and_trace_id_and_no_billing():
    def fail(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            404,
            json={
                "code": "ANALYSIS_NOT_FOUND",
                "message": "분석을 찾지 못했어요.",
                "traceId": "t-1",
            },
            headers={"X-Trace-Id": "t-1"},
        )

    server, _ = server_with(fail)
    with pytest.raises(ToolError) as error:
        asyncio.run(server.call_tool("get_analysis_summary", {"analysis_id": 999}))
    assert "ANALYSIS_NOT_FOUND (404)" in str(error.value)
    assert "traceId=t-1" in str(error.value)
