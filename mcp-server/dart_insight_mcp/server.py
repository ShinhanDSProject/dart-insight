"""DART Insight MCP 서버(읽기 전용 시제품, ADR-0052).

AI 에이전트가 사람과 같은 공개 API로 '검증된 공시 비교 결과'를 가져간다.
숫자는 backend가 계산한 값 그대로이고, 문장에는 근거 위치(접수번호·블록)가 붙어 있다.
분석 요청·노트 같은 쓰기 도구는 과금(크레딧)이 생긴 뒤에 연다.
응답마다 과금 정보(billing)와 출처 안내(notice)를 붙인다.
"""

from __future__ import annotations

from typing import Any, Literal

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from . import paths
from .api import ApiError, DartInsightApi
from .billing import CREDITS_PER_CALL, billing

NOTICE = (
    "출처: 금융감독원 전자공시시스템(DART). "
    "DART Insight는 투자 조언이 아니며 종목 추천을 하지 않아요."
)

INSTRUCTIONS = (
    "DART Insight는 같은 기업의 정기보고서 두 개를 비교해 "
    "바뀐 재무 수치와 문장을 원문 근거와 함께 돌려줘요. "
    "순서: search_companies로 고유번호(corpCode)를 찾고, "
    "list_company_analyses로 이미 끝난 분석(analysisId)을 고른 뒤, "
    "get_analysis_summary·list_text_changes·list_financial_changes로 결과를 읽어요. "
    "숫자는 코드가 계산한 값이니 다시 계산하지 말고, "
    "문장 변화를 인용할 때는 get_text_change로 근거 위치(접수번호·블록)를 받아 함께 밝혀 주세요. "
    "투자 판단·종목 추천에 쓰지 마세요."
)

TextChangeType = Literal["ADDED", "DELETED", "MODIFIED", "NUMERIC_UPDATE", "MOVED"]
StatementDiv = Literal["BS", "IS", "CIS", "CF", "SCE"]


def _describe(text: str, tool: str) -> str:
    return f"{text} (크레딧 가설 {CREDITS_PER_CALL[tool]}, 시제품은 과금 없음)"


def create_server(api: DartInsightApi | None = None) -> MCPServer:
    client = api or DartInsightApi()
    server = MCPServer("dart-insight", instructions=INSTRUCTIONS, version="0.0.1")

    def call(tool: str, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            data = client.get(path, params)
        except ApiError as e:
            # 실패는 과금하지 않고, 에이전트가 고칠 수 있게 코드와 추적 ID를 알린다
            raise ToolError(f"{e.code} ({e.status}): {e.message} · traceId={e.trace_id}") from e
        return {"data": data, "billing": billing(tool), "notice": NOTICE}

    @server.tool(
        description=_describe(
            "회사명·종목코드·초성으로 기업을 찾아 고유번호(corpCode)를 돌려줘요.",
            "search_companies",
        )
    )
    def search_companies(query: str) -> dict[str, Any]:
        return call("search_companies", paths.COMPANIES, {"query": query})

    @server.tool(
        description=_describe(
            "기업의 정기보고서 목록(접수번호·보고서 이름·기간)을 돌려줘요.", "list_reports"
        )
    )
    def list_reports(corp_code: str) -> dict[str, Any]:
        return call("list_reports", paths.company_reports(corp_code))

    @server.tool(
        description=_describe(
            "이 기업에서 이미 끝난 비교 분석 목록(analysisId·두 보고서)을 돌려줘요.",
            "list_company_analyses",
        )
    )
    def list_company_analyses(corp_code: str) -> dict[str, Any]:
        return call("list_company_analyses", paths.company_analyses(corp_code))

    @server.tool(
        description=_describe(
            "분석의 근거 기반 요약: 코드가 만든 사실 문장, "
            "AI 문장('AI 생성'), 근거 위치를 돌려줘요.",
            "get_analysis_summary",
        )
    )
    def get_analysis_summary(analysis_id: int) -> dict[str, Any]:
        return call("get_analysis_summary", paths.analysis_summary(analysis_id))

    @server.tool(
        description=_describe(
            "바뀐 문장·표 목록(우선순위 순, page는 0부터). risk_only면 위험 관련만, "
            "change_type으로 ADDED·DELETED·MODIFIED 등을 거를 수 있어요. "
            "totalItems가 size보다 크면 page를 늘려 이어서 읽어요.",
            "list_text_changes",
        )
    )
    def list_text_changes(
        analysis_id: int,
        risk_only: bool = False,
        change_type: TextChangeType | None = None,
        size: int = 20,
        page: int = 0,
    ) -> dict[str, Any]:
        params = {
            "sort": "priority",
            "risk": "true" if risk_only else None,
            "type": change_type,
            "size": max(1, min(size, 50)),
            "page": max(0, page),
        }
        return call("list_text_changes", paths.text_changes(analysis_id), params)

    @server.tool(
        description=_describe(
            "문장·표 변경 하나의 이전·현재 원문과 근거 위치(접수번호·섹션·블록)를 돌려줘요. "
            "인용할 때 이 위치를 함께 밝혀 주세요.",
            "get_text_change",
        )
    )
    def get_text_change(analysis_id: int, change_id: int) -> dict[str, Any]:
        return call("get_text_change", paths.text_change(analysis_id, change_id))

    @server.tool(
        description=_describe(
            "재무제표 계정별 이전·현재 금액과 코드가 계산한 증감액·증감률을 돌려줘요. "
            "sj_div: BS·IS·CIS·CF·SCE.",
            "list_financial_changes",
        )
    )
    def list_financial_changes(analysis_id: int, sj_div: StatementDiv = "IS") -> dict[str, Any]:
        params = {"sjDiv": sj_div, "size": 100}
        return call("list_financial_changes", paths.financial_changes(analysis_id), params)

    return server


def main() -> None:
    create_server().run("stdio")


if __name__ == "__main__":
    main()
