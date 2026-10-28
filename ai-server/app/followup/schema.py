"""약속과 실제 대조 내부 API의 요청·응답 모양(camelCase)."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.compliance import RULESET_VERSION
from app.followup.model import (
    MAX_CANDIDATES,
    MAX_PLANS,
    PLAN_CATEGORIES,
    FollowupInput,
    Plan,
    Source,
)
from app.followup.prompt import PROMPT_VERSION
from app.followup.service import FollowupOutput


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SourceModel(_Model):
    evidence_id: str
    section_path: str
    text: str


class PlanModel(_Model):
    plan_id: str = Field(min_length=1)
    category: str
    summary: str
    quote: str
    candidates: list[SourceModel] = Field(max_length=MAX_CANDIDATES)


class FollowupRequest(_Model):
    prompt_version: str
    company_name: str
    previous_report_name: str
    current_report_name: str
    plans: list[PlanModel] = Field(min_length=1, max_length=MAX_PLANS)

    def to_input(self) -> FollowupInput:
        """검증한 입력. 버전이 다르거나 id가 겹치거나 종류가 정한 값이 아니면 ValueError."""
        if self.prompt_version != PROMPT_VERSION:
            raise ValueError(
                f"프롬프트 버전이 다릅니다(요청 {self.prompt_version}, AI 서버 {PROMPT_VERSION})."
            )
        ids = [p.plan_id for p in self.plans]
        if len(set(ids)) != len(ids):
            raise ValueError("planId가 겹칩니다.")
        for plan in self.plans:
            if plan.category not in PLAN_CATEGORIES:
                raise ValueError(f"category는 {', '.join(PLAN_CATEGORIES)} 중 하나여야 합니다.")
            evidence = [c.evidence_id for c in plan.candidates]
            if len(set(evidence)) != len(evidence):
                raise ValueError("한 계획 안에서 evidenceId가 겹칩니다.")
        return FollowupInput(
            self.company_name,
            self.previous_report_name,
            self.current_report_name,
            [
                Plan(
                    p.plan_id,
                    p.category,
                    p.summary,
                    p.quote,
                    [Source(c.evidence_id, c.section_path, c.text) for c in p.candidates],
                )
                for p in self.plans
            ],
        )


def output_json(output: FollowupOutput) -> dict[str, Any]:
    result = output.result
    return {
        "promptVersion": output.prompt_version,
        "expressionRulesVersion": RULESET_VERSION,
        "model": output.model,
        "generatedAt": output.generated_at,
        "status": result.status,
        "followups": [
            {
                "planId": f.plan_id,
                "status": f.status,
                "summary": f.summary,
                "quote": f.quote,
                "evidenceIds": f.evidence_ids,
            }
            for f in result.followups
        ],
        "reviewReason": result.review_reason,
        "blockedRules": result.blocked_rules,
        "calls": [c.to_dict() for c in output.calls],
    }
