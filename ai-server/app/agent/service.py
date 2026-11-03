"""에이전트 한 단계(ADR-0044·0045). LLM은 app.llm.LlmClient로만 부른다.

- 투자 판단 요청(app.compliance.scan_question)은 LLM을 부르지 않고 OUT_OF_SCOPE다.
- 다음에 부를 Tool이 있으면 TOOL_CALLS, 자료가 충분하면 검토를 통과한 최종 답(FINAL)이다.
- 답이 검토를 통과하지 못하면 사유를 붙여 다시 쓰고, 생성 예산(처음 1회 + 다시 2회)을 넘으면
  답을 버리고 REVIEW_NEEDED다. 실패를 성공으로 처리하지 않는다.
- LLM을 부를 수 없으면(LlmUnavailable) 그대로 던진다. 부른 쪽이 503으로 바꾼다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.agent import fake
from app.agent.graph import StepState, build_graph
from app.agent.model import FINAL, OUT_OF_SCOPE, FinalAnswer, Rejection, StepInput, ToolCall
from app.agent.prompt import PROMPT_VERSION, TASK_ANSWER, TASK_PLAN
from app.llm import CallRecord, LlmClient
from app.llm.providers import FAKE_RESPONDERS

logger = logging.getLogger("app.agent")
FAKE_RESPONDERS[TASK_PLAN] = fake.respond_plan
FAKE_RESPONDERS[TASK_ANSWER] = fake.respond_answer


@dataclass(frozen=True)
class StepOutput:
    kind: str  # TOOL_CALLS·FINAL·OUT_OF_SCOPE
    prompt_version: str
    model: str | None = None
    generated_at: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    final: FinalAnswer | None = None
    rejections: list[Rejection] = field(default_factory=list)
    calls: list[CallRecord] = field(default_factory=list)


def run_step(llm: LlmClient, step: StepInput) -> StepOutput:
    initial: StepState = {"step": step}
    state: StepState = build_graph(llm).invoke(initial)
    kind = state.get("kind", FINAL)
    if kind == OUT_OF_SCOPE:
        return StepOutput(OUT_OF_SCOPE, PROMPT_VERSION)
    return StepOutput(
        kind=kind,
        prompt_version=PROMPT_VERSION,
        model=state.get("model"),
        generated_at=state.get("generated_at"),
        tool_calls=state.get("tool_calls", []) if kind != FINAL else [],
        final=state.get("final") if kind == FINAL else None,
        rejections=state.get("rejections", []),
        calls=state.get("calls", []),
    )
