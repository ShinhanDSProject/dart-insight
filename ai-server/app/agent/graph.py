"""에이전트 한 단계 그래프(ADR-0045).

route_intent ─┬─ OUT_OF_SCOPE ─────────────────────────→ build_response
             ├─ 빠른 명령 → TOOL_CALLS ───────────────→ build_response
             └─ plan_next_tool ─┬─ TOOL_CALLS ────────→ build_response
                                └─ draft_answer ↔ review_answer
                                       └─ 통과·예산 끝 → build_response
(load_context는 따로 없다: 요청으로 받은 값이 곧 처음 상태다)

- 체크포인터·메모리·도구 노드·interrupt는 쓰지 않는다. 요청마다 backend가 보낸 상태로 시작해
  한 단계를 끝낸다(ADR-0044: Tool은 backend가 실행).
- 노드 안의 LLM 호출은 LlmClient.generate로만 한다. 형식 검사와 일시 오류 재시도는 LlmClient가,
  내용 검사와 반려는 review_answer가 맡는다.
- 답 생성은 처음 1회와 다시 생성 2회가 상한이다. LlmClient가 형식 실패로 다시 만든 것도 같은
  예산에서 센다(그래프와 LlmClient가 따로 세지 않음).
"""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agent.model import (
    FINAL,
    OUT_OF_SCOPE,
    REVIEW_NEEDED,
    TOOL_CALLS,
    FinalAnswer,
    Rejection,
    StepInput,
    ToolCall,
)
from app.agent.prompt import build_answer_request, build_plan_request
from app.agent.validate import Draft, parse_draft, parse_plan, review
from app.compliance import scan_question
from app.llm import CallRecord, LlmClient, LlmOutputInvalid, LlmUnavailable
from app.llm.client import OUTCOME_INVALID_OUTPUT, OUTCOME_OK

logger = logging.getLogger("app.agent")

# 빠른 명령: LLM 없이 정해진 Tool로 보낸다. 받은 Tool 목록에 그 Tool이 있을 때만 쓴다
QUICK_COMMANDS: dict[str, tuple[str, dict[str, Any]]] = {
    "/요약": ("get_summary", {}),
    "/재무": ("get_financial_changes", {}),
    "/위험": ("search_text_changes", {"risk": True}),
}

NOT_VERIFIED = "다시 생성해도 근거·숫자·표현 확인을 통과하지 못했어요."
BLOCKED = "투자 권유로 읽힐 수 있는 표현이 있어 답을 내보내지 않았어요."
TOOLS_FAILED = "필요한 자료를 불러오지 못해 답을 확인할 수 없었어요."

# route_intent가 고르는 다음 노드
_PLAN = "plan_next_tool"
_DRAFT = "draft_answer"
_REVIEW = "review_answer"
_RESPOND = "build_response"


class StepState(TypedDict, total=False):
    """그래프 상태. LangGraph가 노드가 돌려준 키로 상태를 바꾸므로 TypedDict로 둔다
    (conventions PY-2의 예외). 안에 든 값은 frozen dataclass다.
    """

    step: StepInput
    kind: str  # TOOL_CALLS·FINAL·OUT_OF_SCOPE
    next: str
    tool_calls: list[ToolCall]
    draft: Draft | None
    final: FinalAnswer | None
    problems: list[str]
    generations: int
    rejections: list[Rejection]
    calls: list[CallRecord]
    model: str | None
    generated_at: str | None


def build_graph(llm: LlmClient) -> Any:
    max_generations = llm.settings.max_output_retries + 1

    def route_intent(state: StepState) -> StepState:
        step = state["step"]
        if scan_question(step.message):
            return {"kind": OUT_OF_SCOPE, "next": _RESPOND}
        quick = _quick_call(step)
        if quick is not None:
            return {"kind": TOOL_CALLS, "tool_calls": [quick], "next": _RESPOND}
        if step.remaining_steps <= 0 or _quick_done(step):
            return {"next": _DRAFT}
        return {"next": _PLAN}

    def plan_next_tool(state: StepState) -> StepState:
        step = state["step"]
        calls = list(state.get("calls", []))
        try:
            result = _generate(llm, calls, build_plan_request(step), lambda d: parse_plan(d, step))
        except LlmOutputInvalid as e:
            # 다음 Tool을 고르지 못하면 지금까지의 결과로 답한다
            logger.warning("다음 Tool 고르기 실패, 받은 결과로 답함: %s", e.problems[:3])
            calls += e.calls
            return {"calls": calls, "next": _DRAFT}
        calls += result.calls
        fresh = [c for c in result.value if not _already_called(step, c)]
        if not fresh:
            return {"calls": calls, "next": _DRAFT}
        return {
            "calls": calls,
            "kind": TOOL_CALLS,
            "tool_calls": fresh,
            "model": result.model,
            "generated_at": result.generated_at,
            "next": _RESPOND,
        }

    def draft_answer(state: StepState) -> StepState:
        step = state["step"]
        calls = list(state.get("calls", []))
        generations = state.get("generations", 0)
        remaining = max_generations - generations
        request = build_answer_request(step, state.get("problems", []))
        try:
            result = _generate(llm, calls, request, parse_draft, max_output_retries=remaining - 1)
        except LlmOutputInvalid as e:
            calls += e.calls
            return {
                "calls": calls,
                "generations": generations + _generation_count(e.calls),
                "final": FinalAnswer(REVIEW_NEEDED, review_reason=NOT_VERIFIED),
                "kind": FINAL,
                "model": e.calls[-1].model if e.calls else None,
                "generated_at": e.calls[-1].called_at if e.calls else None,
                "next": _RESPOND,
            }
        calls += result.calls
        return {
            "calls": calls,
            "generations": generations + _generation_count(result.calls),
            "draft": result.value,
            "model": result.model,
            "generated_at": result.generated_at,
            "next": _REVIEW,
        }

    def review_answer(state: StepState) -> StepState:
        step = state["step"]
        draft = state["draft"]
        assert draft is not None
        generations = state.get("generations", 0)
        reviewed = review(draft, step)
        if reviewed.final is not None:
            return {"final": reviewed.final, "kind": FINAL, "next": _RESPOND}
        rejections = [*state.get("rejections", []), Rejection(generations, reviewed.rules)]
        logger.info("답 반려(%d/%d): %s", generations, max_generations, reviewed.rules)
        if reviewed.terminal or generations >= max_generations:
            reason = TOOLS_FAILED if reviewed.terminal else NOT_VERIFIED
            if reviewed.blocked_rules:
                reason = BLOCKED
            final = FinalAnswer(
                REVIEW_NEEDED, review_reason=reason, blocked_rules=reviewed.blocked_rules
            )
            return {"rejections": rejections, "final": final, "kind": FINAL, "next": _RESPOND}
        return {"rejections": rejections, "problems": reviewed.problems, "next": _DRAFT}

    def build_response(state: StepState) -> StepState:
        return {}

    graph = StateGraph(StepState)
    graph.add_node("route_intent", route_intent)
    graph.add_node(_PLAN, plan_next_tool)
    graph.add_node(_DRAFT, draft_answer)
    graph.add_node(_REVIEW, review_answer)
    graph.add_node(_RESPOND, build_response)
    graph.add_edge(START, "route_intent")
    for node in ("route_intent", _PLAN, _DRAFT, _REVIEW):
        graph.add_conditional_edges(node, _next)
    graph.add_edge(_RESPOND, END)
    return graph.compile()


def _next(state: StepState) -> str:
    return state["next"]


def _generate(
    llm: LlmClient,
    calls: list[CallRecord],
    request: Any,
    validate: Any,
    max_output_retries: int | None = None,
) -> Any:
    """LlmClient.generate. 쓸 수 없으면 앞 노드의 호출 기록까지 담아 던진다(X-Llm-Calls)."""
    try:
        return llm.generate(request, validate, max_output_retries=max_output_retries)
    except LlmUnavailable as e:
        raise LlmUnavailable(e.message, [*calls, *e.calls]) from e


def _generation_count(calls: list[CallRecord]) -> int:
    """답을 받은 호출 수. 일시 오류 재시도는 생성이 아니라서 세지 않는다."""
    return sum(1 for c in calls if c.outcome in (OUTCOME_OK, OUTCOME_INVALID_OUTPUT))


def _quick_command(step: StepInput) -> tuple[str, dict[str, Any]] | None:
    words = step.message.strip().split()
    command = QUICK_COMMANDS.get(words[0]) if words else None
    if command is None or step.tool(command[0]) is None:
        return None
    return command


def _quick_call(step: StepInput) -> ToolCall | None:
    command = _quick_command(step)
    if command is None or step.remaining_steps <= 0 or _quick_done(step):
        return None
    name, arguments = command
    return ToolCall(f"c{len(step.tool_results) + 1}", name, arguments)


def _quick_done(step: StepInput) -> bool:
    command = _quick_command(step)
    return command is not None and any(r.name == command[0] for r in step.tool_results)


def _already_called(step: StepInput, call: ToolCall) -> bool:
    return any(r.name == call.name and r.arguments == call.arguments for r in step.tool_results)
