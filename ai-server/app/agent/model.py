"""에이전트 한 단계(ADR-0044·0045)의 입력·결과.

Tool은 backend가 실행한다. ai-server는 받은 Tool 결과만 보고 다음에 부를 Tool이나 최종 답 하나를
정한다. Tool·액션 목록도 backend가 요청마다 보낸다(이 코드에 따로 두지 않음).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# 한 단계의 결과 종류(docs/api-spec.md POST /internal/agent-steps)
TOOL_CALLS = "TOOL_CALLS"
FINAL = "FINAL"
OUT_OF_SCOPE = "OUT_OF_SCOPE"

# 최종 답 상태
ANSWERED = "ANSWERED"
NOT_FOUND = "NOT_FOUND"
REVIEW_NEEDED = "REVIEW_NEEDED"
# LLM이 고를 수 있는 상태
LLM_STATUSES = (ANSWERED, NOT_FOUND)

# 답 형식. 정리 형식(BRIEF)은 #581에서 더한다
FORMAT_CHAT = "CHAT"
FORMAT_BRIEF = "BRIEF"

# 한 단계에서 부를 수 있는 Tool 수
MAX_TOOL_CALLS = 3

# 대화 역할
ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"
ROLES = (ROLE_USER, ROLE_ASSISTANT)


@dataclass(frozen=True)
class ToolSpec:
    """backend가 허용한 Tool 하나. parameters는 인자의 JSON Schema(object)다."""

    name: str
    description: str
    parameters: dict[str, Any]


@dataclass(frozen=True)
class ActionSpec:
    """화면 액션 하나. parameters는 type을 뺀 필드의 JSON Schema(object)다."""

    type: str
    parameters: dict[str, Any]


@dataclass(frozen=True)
class ResultItem:
    """Tool 결과의 한 줄. text는 backend가 만든 글이다.

    evidence_id가 없으면 답의 근거로 쓸 수 없고 액션 값으로만 쓴다.
    grade는 저장된 재무 설명 등급(STATED·RELATED·NONE, ADR-0015)이 있을 때만 있다.
    """

    evidence_id: str | None
    text: str
    grade: str | None = None


@dataclass(frozen=True)
class ToolResult:
    call_id: str
    name: str
    arguments: dict[str, Any]
    ok: bool
    error: str | None = None
    truncated: bool = False
    items: list[ResultItem] = field(default_factory=list)


@dataclass(frozen=True)
class Turn:
    role: str  # ROLES
    text: str


@dataclass(frozen=True)
class StepInput:
    company_name: str
    previous_report: str | None
    current_report: str
    message: str
    history: list[Turn]
    context: dict[str, Any]
    tools: list[ToolSpec]
    actions: list[ActionSpec]
    tool_results: list[ToolResult]
    remaining_steps: int

    def tool(self, name: str) -> ToolSpec | None:
        return next((t for t in self.tools if t.name == name), None)

    def action(self, action_type: str) -> ActionSpec | None:
        return next((a for a in self.actions if a.type == action_type), None)

    def evidence(self) -> dict[str, ResultItem]:
        """실행에 성공한 Tool 결과의 근거 ID → 그 줄. 답은 여기 있는 ID만 근거로 쓴다."""
        return {
            item.evidence_id: item
            for result in self.tool_results
            if result.ok
            for item in result.items
            if item.evidence_id
        }

    def all_tools_failed(self) -> bool:
        """Tool을 실행했는데 모두 실패했는지. 실패는 '자료 없음(NOT_FOUND)'의 근거가 되지 않는다."""
        return bool(self.tool_results) and not any(r.ok for r in self.tool_results)


@dataclass(frozen=True)
class ToolCall:
    call_id: str
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class FinalAnswer:
    status: str
    answer: str | None = None
    evidence_ids: list[str] = field(default_factory=list)
    actions: list[dict[str, Any]] = field(default_factory=list)
    review_reason: str | None = None
    blocked_rules: list[str] = field(default_factory=list)
    format: str = FORMAT_CHAT


@dataclass(frozen=True)
class Rejection:
    """검토 노드가 반려한 회차와 규칙 ID."""

    attempt: int
    rules: list[str]
