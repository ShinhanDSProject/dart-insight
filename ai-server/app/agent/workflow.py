"""정해진 Tool 순서로 처리하는 요청(ADR-0045 workflow_step, #581).

- 원인 추적(CAUSE_TRACE): get_financial_changes·get_summary → (회사 설명 인용이 없으면)
  search_text_changes. 저장된 설명 등급·인용을 그대로 쓰고, 새로 찾은 문장은 등급 없이
  '관련 문장'이다.
- 교차 검증(CROSS_CHECK): get_financial_changes·get_summary·(있으면) get_plan_followups.
  crossCheck.result는 cross_check()가 정하고 LLM은 바꾸지 못한다
  (docs/api-spec.md 3절 '교차 검증 판정').

어느 Workflow를 쓸지는 첫 Tool 고르기에서 LLM이 고르고, 그 뒤 Tool 순서는 이 모듈이 정한다.
한 단계는 상태를 들고 있지 않으므로 Workflow로 부른 Tool은 callId 머리(cause-·cross-)로 알아본다.
받은 tools에 필요한 Tool이 없으면 Workflow를 쓰지 않고 일반 경로로 간다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.agent.model import CrossCheck, ResultItem, StepInput, ToolCall, ToolResult
from app.agent.validate import schema_problem

CAUSE_TRACE = "CAUSE_TRACE"
CROSS_CHECK = "CROSS_CHECK"
WORKFLOWS = (CAUSE_TRACE, CROSS_CHECK)

FINANCIAL_CHANGES = "get_financial_changes"
SUMMARY = "get_summary"
SEARCH_TEXT_CHANGES = "search_text_changes"
PLAN_FOLLOWUPS = "get_plan_followups"

# 없으면 그 Workflow를 쓰지 않는 Tool
REQUIRED_TOOLS = {
    CAUSE_TRACE: (FINANCIAL_CHANGES, SUMMARY),
    CROSS_CHECK: (FINANCIAL_CHANGES, SUMMARY),
}
_CALL_PREFIX = {CAUSE_TRACE: "cause-", CROSS_CHECK: "cross-"}
# 화면에서 고른 변경을 첫 왕복 전에 넣은 결과(backend). Workflow 시작을 막지 않는다
_CONTEXT_PREFIX = "ctx-"

# 교차 검증 결과(공개 API crossCheck.result)
CONSISTENT = "CONSISTENT"
POTENTIAL_MISMATCH = "POTENTIAL_MISMATCH"
INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
NOT_COMPARABLE = "NOT_COMPARABLE"

UP = "UP"
DOWN = "DOWN"
# 방향을 대조하는 계정의 계산 상태. 손실 계정(LOSS_NARROWED·LOSS_WIDENED·PREVIOUS_NEGATIVE·
# SIGN_CHANGED)은 '손실 감소'처럼 말과 금액의 방향이 거꾸로 읽힐 수 있어 대조하지 않는다
COMPARED_STATUSES = frozenset({"OK", "PREVIOUS_ZERO", "TURNED_PROFIT", "TURNED_LOSS"})
# 기준이 달라 대조하지 않는 계정
NOT_COMPARABLE_STATUSES = frozenset(
    {
        "PERIOD_MISMATCH",
        "AMBIGUOUS_MATCH",
        "ONLY_CURRENT",
        "ONLY_PREVIOUS",
        "PREVIOUS_MISSING",
        "CURRENT_MISSING",
    }
)
# 회사 설명 인용으로 보는 등급(ADR-0015)
EXPLANATION_GRADES = frozenset({"STATED", "RELATED"})

# 설명 방향 낱말. '개선'·'악화' 같은 가치판단 낱말은 넣지 않는다
_UP_WORDS = re.compile(r"증가|늘|확대|상승|성장")
_DOWN_WORDS = re.compile(r"감소|줄|축소|하락|감축")
# 줄 글 앞의 머리말([요약 인용, 등급 RELATED] 등)
_HEAD = re.compile(r"^\[[^\[\]\n]*\]\s*")

NOT_COMPARABLE_REASON = "대조할 계정이 모두 기간·계정 짝 같은 기준이 달라 대조하지 않았어요."
INSUFFICIENT_REASON = "재무 수치와 방향을 대조할 수 있는 회사 설명 인용이 없어요."


@dataclass(frozen=True)
class Choice:
    """첫 Tool 고르기가 고른 Workflow. account는 사용자가 말한 계정 이름(없으면 None)."""

    workflow: str
    account: str | None = None


def available(step: StepInput) -> list[str]:
    """받은 tools로 쓸 수 있는 Workflow."""
    return [w for w in WORKFLOWS if all(step.tool(name) for name in REQUIRED_TOOLS[w])]


def can_start(step: StepInput) -> bool:
    """Workflow는 첫 Tool 고르기에서만 시작한다(화면에서 고른 변경 결과는 세지 않음)."""
    return not any(not r.call_id.startswith(_CONTEXT_PREFIX) for r in step.tool_results)


def choice(data: Any, step: StepInput) -> Choice | None:
    """Tool 고르기 출력의 workflow. 고르지 않았거나 지금 쓸 수 없으면 None이다."""
    if not isinstance(data, dict) or not isinstance(data.get("workflow"), dict):
        return None
    workflow = data["workflow"].get("type")
    if workflow not in available(step) or not can_start(step):
        return None
    account = data["workflow"].get("account")
    account = account.strip() if isinstance(account, str) and account.strip() else None
    return Choice(workflow, account)


def active(step: StepInput) -> str | None:
    """지금 진행 중인 Workflow(앞서 Workflow로 부른 Tool 결과가 있으면)."""
    for result in step.tool_results:
        for workflow, prefix in _CALL_PREFIX.items():
            if result.call_id.startswith(prefix):
                return workflow
    return None


def start_calls(step: StepInput, chosen: Choice) -> list[ToolCall]:
    """Workflow의 첫 왕복. 서로 기대지 않는 Tool을 한 번에 부른다."""
    if step.remaining_steps <= 0:
        return []
    financial: dict[str, Any] = {"q": chosen.account} if chosen.account else {}
    if _argument_problem(step, FINANCIAL_CHANGES, financial):
        financial = {}
    wanted: list[tuple[str, dict[str, Any]]] = [(FINANCIAL_CHANGES, financial), (SUMMARY, {})]
    if chosen.workflow == CROSS_CHECK:
        wanted.append((PLAN_FOLLOWUPS, {}))
    return _calls(step, chosen.workflow, wanted)


def next_calls(step: StepInput, workflow: str) -> list[ToolCall]:
    """Workflow의 다음 왕복. 더 부를 Tool이 없으면 빈 목록이고, 그때는 받은 결과로 답한다."""
    if step.remaining_steps <= 0 or workflow != CAUSE_TRACE:
        return []
    if any(r.name == SEARCH_TEXT_CHANGES for r in step.tool_results):
        return []
    # 요약에 다른 계정의 설명 인용만 있으면 이 계정의 설명은 없는 것이다
    asked = {
        item.facts.change_id
        for result in _ok(step, FINANCIAL_CHANGES)
        for item in result.items
        if item.facts is not None and item.facts.change_id is not None
    }
    if asked & _explanation_quotes(step).keys():
        return []
    account = next(
        (
            r.arguments.get("q")
            for r in step.tool_results
            if r.name == FINANCIAL_CHANGES and isinstance(r.arguments.get("q"), str)
        ),
        None,
    )
    # 계정을 모르면 무엇과 관련된 문장인지 정할 수 없어 찾지 않는다
    if not account:
        return []
    return _calls(step, workflow, [(SEARCH_TEXT_CHANGES, {"q": account})])


def cross_check(step: StepInput) -> CrossCheck:
    """교차 검증 결과. 계정마다 수치 방향과 같은 계정의 회사 설명 인용 방향을 대조한다."""
    changes = [
        item
        for result in _ok(step, FINANCIAL_CHANGES)
        for item in result.items
        if item.facts is not None and item.facts.change_id is not None and item.facts.calc_status
    ]
    quotes = _explanation_quotes(step)
    compared = [c for c in changes if c.facts and c.facts.calc_status in COMPARED_STATUSES]
    other_basis = [c for c in changes if c.facts and c.facts.calc_status in NOT_COMPARABLE_STATUSES]
    if not compared and other_basis:
        return CrossCheck(NOT_COMPARABLE, NOT_COMPARABLE_REASON)
    matched = 0
    opposite = 0
    for change in compared:
        assert change.facts is not None
        number = change.facts.direction
        if number not in (UP, DOWN):
            continue
        said = {d for q in quotes.get(change.facts.change_id, []) if (d := _said_direction(q))}
        if not said:
            continue
        if any(d != number for d in said):
            opposite += 1
        else:
            matched += 1
    checked = matched + opposite
    if opposite:
        return CrossCheck(
            POTENTIAL_MISMATCH,
            f"대조한 계정 {checked}개 중 {opposite}개의 회사 설명 방향이 수치 방향과 반대예요. "
            "검토할 신호이고 오류로 확정한 것은 아니에요.",
        )
    if matched:
        return CrossCheck(
            CONSISTENT, f"대조한 계정 {checked}개 모두 회사 설명 방향이 수치 방향과 같아요."
        )
    return CrossCheck(INSUFFICIENT_EVIDENCE, INSUFFICIENT_REASON)


def _said_direction(item: ResultItem) -> str | None:
    text = _HEAD.sub("", item.text)
    up = bool(_UP_WORDS.search(text))
    down = bool(_DOWN_WORDS.search(text))
    if up == down:  # 양쪽이 다 있거나(여러 계정이 섞인 인용) 하나도 없음
        return None
    return UP if up else DOWN


def _explanation_quotes(step: StepInput) -> dict[int, list[ResultItem]]:
    """계정(changeId) → 저장된 회사 설명 인용(STATED·RELATED).

    재무 요약 줄(F…)은 빼고 원문 인용만 본다.
    """
    quotes: dict[int, list[ResultItem]] = {}
    for result in _ok(step, SUMMARY):
        for item in result.items:
            if (
                item.facts is not None
                and item.facts.change_id is not None
                and item.grade in EXPLANATION_GRADES
                and item.evidence_id
                and "#B" in item.evidence_id
            ):
                quotes.setdefault(item.facts.change_id, []).append(item)
    return quotes


def _ok(step: StepInput, name: str) -> list[ToolResult]:
    return [r for r in step.tool_results if r.ok and r.name == name]


def _argument_problem(step: StepInput, name: str, arguments: dict[str, Any]) -> str | None:
    tool = step.tool(name)
    if tool is None:
        return "없는 Tool"
    return schema_problem(arguments, tool.parameters)


def _calls(
    step: StepInput, workflow: str, wanted: list[tuple[str, dict[str, Any]]]
) -> list[ToolCall]:
    """받은 tools에 있고 인자가 맞으며 아직 같은 인자로 부르지 않은 것만."""
    prefix = _CALL_PREFIX[workflow]
    calls: list[ToolCall] = []
    for name, arguments in wanted:
        if _argument_problem(step, name, arguments):
            continue
        if any(r.name == name and r.arguments == arguments for r in step.tool_results):
            continue
        calls.append(
            ToolCall(f"{prefix}{len(step.tool_results) + len(calls) + 1}", name, arguments)
        )
    return calls
