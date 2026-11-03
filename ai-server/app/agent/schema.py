"""에이전트 한 단계 내부 API의 요청·응답 모양(camelCase, docs/api-spec.md 3절)."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.agent.model import (
    FINAL,
    ROLES,
    ActionSpec,
    ResultItem,
    StepInput,
    ToolResult,
    ToolSpec,
    Turn,
)
from app.agent.service import StepOutput
from app.compliance import RULESET_VERSION

MAX_HISTORY = 6


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TurnModel(_Model):
    role: str
    text: str


class ToolModel(_Model):
    name: str
    description: str
    parameters: dict[str, Any]


class ActionModel(_Model):
    type: str
    parameters: dict[str, Any]


class ItemModel(_Model):
    evidence_id: str | None = None
    text: str
    grade: str | None = None


class ToolResultModel(_Model):
    call_id: str
    name: str
    arguments: dict[str, Any] = {}
    ok: bool
    error: str | None = None
    truncated: bool = False
    items: list[ItemModel] = []


class StepRequest(_Model):
    company_name: str
    previous_report: str | None = None
    current_report: str
    message: str
    history: list[TurnModel] = Field(default=[], max_length=MAX_HISTORY)
    context: dict[str, Any] = {}
    tools: list[ToolModel]
    actions: list[ActionModel] = []
    tool_results: list[ToolResultModel] = []
    remaining_steps: int

    def to_input(self) -> StepInput:
        if not self.tools:
            raise ValueError("tools가 비었습니다.")
        names = [t.name for t in self.tools]
        if len(set(names)) != len(names):
            raise ValueError("Tool 이름이 겹칩니다.")
        call_ids = [r.call_id for r in self.tool_results]
        if len(set(call_ids)) != len(call_ids):
            raise ValueError("callId가 겹칩니다.")
        unknown = [r.name for r in self.tool_results if r.name not in names]
        if unknown:
            raise ValueError(f"tools에 없는 Tool의 결과입니다: {unknown[:3]}")
        if self.remaining_steps < 0:
            raise ValueError("remainingSteps는 0 이상이어야 합니다.")
        if any(turn.role not in ROLES for turn in self.history):
            raise ValueError(f"history의 role은 {list(ROLES)} 중 하나여야 합니다.")
        return StepInput(
            self.company_name,
            self.previous_report,
            self.current_report,
            self.message,
            [Turn(t.role, t.text) for t in self.history],
            dict(self.context),
            [ToolSpec(t.name, t.description, t.parameters) for t in self.tools],
            [ActionSpec(a.type, a.parameters) for a in self.actions],
            [
                ToolResult(
                    r.call_id,
                    r.name,
                    dict(r.arguments),
                    r.ok,
                    r.error,
                    r.truncated,
                    [ResultItem(i.evidence_id, i.text, i.grade) for i in r.items],
                )
                for r in self.tool_results
            ],
            self.remaining_steps,
        )


def output_json(output: StepOutput) -> dict[str, Any]:
    final = output.final
    return {
        "promptVersion": output.prompt_version,
        "expressionRulesVersion": RULESET_VERSION,
        "model": output.model,
        "generatedAt": output.generated_at,
        "type": output.kind,
        "toolCalls": [
            {"callId": c.call_id, "name": c.name, "arguments": c.arguments}
            for c in output.tool_calls
        ],
        "final": (
            {
                "status": final.status,
                "answer": final.answer,
                "evidenceIds": final.evidence_ids,
                "actions": final.actions,
                "reviewReason": final.review_reason,
                "blockedRules": final.blocked_rules,
                "format": final.format,
                "crossCheck": None,
            }
            if output.kind == FINAL and final is not None
            else None
        ),
        "rejections": [{"attempt": r.attempt, "rules": r.rules} for r in output.rejections],
        "calls": [c.to_dict() for c in output.calls],
    }
