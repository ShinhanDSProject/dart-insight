"""요약 내부 API의 요청·응답 모양(camelCase)."""

from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.compliance import RULESET_VERSION
from app.summary.model import FinancialItem, ItemResult, Source, SummaryInput, TextItem
from app.summary.service import SummaryOutput


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SourceModel(_Model):
    evidence_id: str
    section_path: str
    text: str

    def to_source(self) -> Source:
        return Source(self.evidence_id, self.section_path, self.text)


class TextItemModel(_Model):
    ref: str
    change_type: str
    section_path: str
    sources: list[SourceModel]


class FinancialItemModel(_Model):
    ref: str
    account_name: str
    direction: str | None = None
    account_aliases: list[str] = []
    candidates: list[SourceModel] = []


class SummaryRequest(_Model):
    company_name: str
    previous_report: str
    current_report: str
    text_items: list[TextItemModel] = []
    financial_items: list[FinancialItemModel] = []

    def to_input(self) -> SummaryInput:
        refs = [i.ref for i in self.text_items] + [i.ref for i in self.financial_items]
        if len(set(refs)) != len(refs):
            raise ValueError("ref가 겹칩니다.")
        return SummaryInput(
            self.company_name,
            self.previous_report,
            self.current_report,
            [
                TextItem(i.ref, i.change_type, i.section_path, [s.to_source() for s in i.sources])
                for i in self.text_items
            ],
            [
                FinancialItem(
                    i.ref,
                    i.account_name,
                    i.direction,
                    [s.to_source() for s in i.candidates],
                    i.account_aliases,
                )
                for i in self.financial_items
            ],
        )


def _item(item: ItemResult) -> dict[str, Any]:
    return {
        "ref": item.ref,
        "kind": item.kind,
        "status": item.status,
        "sentence": item.sentence,
        "explanation": item.explanation,
        "evidenceIds": item.evidence_ids,
        "reviewReason": item.review_reason,
        "blockedRules": item.blocked_rules,
    }


def output_json(output: SummaryOutput) -> dict[str, Any]:
    return {
        "promptVersion": output.prompt_version,
        "expressionRulesVersion": RULESET_VERSION,
        "model": output.model,
        "generatedAt": output.generated_at,
        "items": [_item(i) for i in output.items],
        "calls": [c.to_dict() for c in output.calls],
    }
