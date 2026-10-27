"""회사가 밝힌 전망·계획 내부 API의 요청·응답 모양(camelCase)."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.compliance import RULESET_VERSION
from app.outlook.model import MAX_SOURCES, OutlookInput, Source
from app.outlook.prompt import PROMPT_VERSION
from app.outlook.service import OutlookOutput


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SourceModel(_Model):
    evidence_id: str
    section_path: str
    text: str


class OutlookRequest(_Model):
    prompt_version: str
    company_name: str
    report_name: str
    sources: list[SourceModel] = Field(min_length=1, max_length=MAX_SOURCES)

    def to_input(self) -> OutlookInput:
        """검증한 입력. 버전이 다르거나 근거 ID가 겹치면 ValueError."""
        if self.prompt_version != PROMPT_VERSION:
            raise ValueError(
                f"프롬프트 버전이 다릅니다(요청 {self.prompt_version}, AI 서버 {PROMPT_VERSION})."
            )
        ids = [s.evidence_id for s in self.sources]
        if len(set(ids)) != len(ids):
            raise ValueError("evidenceId가 겹칩니다.")
        return OutlookInput(
            self.company_name,
            self.report_name,
            [Source(s.evidence_id, s.section_path, s.text) for s in self.sources],
        )


def output_json(output: OutlookOutput) -> dict[str, Any]:
    result = output.result
    return {
        "promptVersion": output.prompt_version,
        "expressionRulesVersion": RULESET_VERSION,
        "model": output.model,
        "generatedAt": output.generated_at,
        "status": result.status,
        "items": [
            {
                "category": i.category,
                "summary": i.summary,
                "quote": i.quote,
                "evidenceIds": i.evidence_ids,
            }
            for i in result.items
        ],
        "reviewReason": result.review_reason,
        "blockedRules": result.blocked_rules,
        "calls": [c.to_dict() for c in output.calls],
    }
