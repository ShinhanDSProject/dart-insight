"""질문 답변 내부 API의 요청·응답 모양(camelCase)."""

from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.answer.model import AnswerInput, Fact, Source
from app.answer.service import AnswerOutput
from app.compliance import RULESET_VERSION


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class FactModel(_Model):
    ref: str
    sentence: str


class SourceModel(_Model):
    evidence_id: str
    side: str
    section_path: str
    text: str


class AnswerRequest(_Model):
    company_name: str
    previous_report: str
    current_report: str
    question: str
    facts: list[FactModel] = []
    sources: list[SourceModel] = []

    def to_input(self) -> AnswerInput:
        ids = [s.evidence_id for s in self.sources]
        if len(set(ids)) != len(ids):
            raise ValueError("evidenceId가 겹칩니다.")
        refs = [f.ref for f in self.facts]
        if len(set(refs)) != len(refs):
            raise ValueError("ref가 겹칩니다.")
        return AnswerInput(
            self.company_name,
            self.previous_report,
            self.current_report,
            self.question,
            [Fact(f.ref, f.sentence) for f in self.facts],
            [Source(s.evidence_id, s.side, s.section_path, s.text) for s in self.sources],
        )


def output_json(output: AnswerOutput) -> dict[str, Any]:
    result = output.result
    return {
        "promptVersion": output.prompt_version,
        "expressionRulesVersion": RULESET_VERSION,
        "model": output.model,
        "generatedAt": output.generated_at,
        "status": result.status,
        "answer": result.answer,
        "evidenceIds": result.evidence_ids,
        "factRefs": result.fact_refs,
        "reviewReason": result.review_reason,
        "blockedRules": result.blocked_rules,
        "calls": [c.to_dict() for c in output.calls],
    }
