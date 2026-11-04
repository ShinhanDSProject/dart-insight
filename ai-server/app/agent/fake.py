"""에이전트 가짜 응답(개발·테스트용). 실제 LLM 없이 입력만으로 검사를 통과하는 결과를 만든다.

- 다음 Tool 고르기: 아직 Tool 결과가 없으면 필수 인자가 없는 첫 Tool을 부르고, 있으면 답한다.
- 답: 실행에 성공한 결과의 첫 근거를 인용한다. 근거가 없으면 NOT_FOUND다.
결과에는 모델 이름 `fake-model`이 남아 실제 답과 구분된다.
"""

from __future__ import annotations

import re
from typing import Any

from app.agent.model import ANSWERED, NOT_FOUND, StepInput
from app.agent.validate import ANSWER, CALL_TOOLS
from app.llm.providers import LlmRequest

SNIPPET_CHARS = 60
_SPACES = re.compile(r"\s+")


def respond_plan(request: LlmRequest) -> dict[str, Any]:
    step = request.context
    if isinstance(step, StepInput) and not step.tool_results:
        tool = next((t for t in step.tools if not t.parameters.get("required")), None)
        if tool is not None:
            return {
                "decision": CALL_TOOLS,
                "toolCalls": [{"name": tool.name, "arguments": {}}],
                "draft": None,
            }
    return {"decision": ANSWER, "toolCalls": [], "draft": None}


def respond_answer(request: LlmRequest) -> dict[str, Any]:
    step = request.context
    if isinstance(step, StepInput):
        for evidence_id, item in step.evidence().items():
            answer = f"관련 내용으로 '{_snippet(item.text)}'이 있어요[{evidence_id}]."
            return {
                "status": ANSWERED,
                "answer": answer,
                "evidenceIds": [evidence_id],
                "actions": [],
            }
    return {"status": NOT_FOUND, "answer": None, "evidenceIds": [], "actions": []}


def _snippet(text: str) -> str:
    """앞부분을 낱말 단위로 자른다. 숫자가 중간에서 잘려 숫자 검사에 걸리지 않게 한다."""
    flat = _SPACES.sub(" ", text.replace("[", "(").replace("]", ")")).strip()
    if len(flat) <= SNIPPET_CHARS:
        return flat
    cut = flat[:SNIPPET_CHARS]
    if flat[SNIPPET_CHARS] != " " and " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip() + "…"
