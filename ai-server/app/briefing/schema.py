"""AI 기업 브리핑 내부 API의 요청·응답 모양(camelCase)."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.briefing.model import MAX_SOURCES, TOPICS, BriefingInput, Source
from app.briefing.prompt import PROMPT_VERSION
from app.briefing.service import BriefingOutput
from app.compliance import RULESET_VERSION


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SourceModel(_Model):
    evidence_id: str
    topic: str
    section_path: str
    text: str


class BriefingRequest(_Model):
    prompt_version: str
    company_name: str
    report_name: str
    sources: list[SourceModel] = Field(min_length=1, max_length=MAX_SOURCES)

    def to_input(self) -> BriefingInput:
        """검증한 입력. 버전이 다르거나 근거 ID가 겹치거나 주제를 모르면 ValueError."""
        if self.prompt_version != PROMPT_VERSION:
            raise ValueError(
                f"프롬프트 버전이 다릅니다(요청 {self.prompt_version}, AI 서버 {PROMPT_VERSION})."
            )
        ids = [s.evidence_id for s in self.sources]
        if len(set(ids)) != len(ids):
            raise ValueError("evidenceId가 겹칩니다.")
        unknown = sorted({s.topic for s in self.sources} - set(TOPICS))
        if unknown:
            raise ValueError(f"알 수 없는 topic입니다: {unknown}")
        return BriefingInput(
            self.company_name,
            self.report_name,
            [Source(s.evidence_id, s.topic, s.section_path, s.text) for s in self.sources],
        )


def output_json(output: BriefingOutput) -> dict[str, Any]:
    result = output.result
    return {
        "promptVersion": output.prompt_version,
        "expressionRulesVersion": RULESET_VERSION,
        "model": output.model,
        "generatedAt": output.generated_at,
        "status": result.status,
        "sentences": [{"text": s.text, "evidenceIds": s.evidence_ids} for s in result.sentences],
        "reviewReason": result.review_reason,
        "blockedRules": result.blocked_rules,
        "calls": [c.to_dict() for c in output.calls],
    }
