"""두 보고서 사이 활동 내부 API의 요청·응답 모양(camelCase)."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.activity.model import CURRENT, MAX_SOURCES, PREVIOUS, TEXT_LIMIT, ActivityInput, Source
from app.activity.prompt import PROMPT_VERSION
from app.activity.service import ActivityOutput
from app.compare.text_diff import ADDED
from app.compliance import RULESET_VERSION
from app.events.candidates import CandidateChange, is_candidate
from app.events.signals import load_table

PRIORITY_FIELDS = frozenset({"LITIGATION", "CONTRACT", "FUNDING", "DIVIDEND", "AUDIT"})
# 한 요청에 받는 변경 수. 후보 규칙으로 줄인 뒤 원문 수 제한(MAX_SOURCES)을 다시 건다
MAX_CHANGES = 5000


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ChangeModel(_Model):
    change_no: int
    change_type: str
    block_type: str
    list_group: str
    field: str | None = None
    raised_from_note: bool = False
    section_path: str = ""
    previous_evidence_id: str | None = None
    current_evidence_id: str | None = None
    previous_text: str | None = None
    current_text: str | None = None


class ActivityRequest(_Model):
    prompt_version: str
    company_name: str
    previous_report_name: str
    current_report_name: str
    changes: list[ChangeModel] = Field(max_length=MAX_CHANGES)

    def to_input(self) -> ActivityInput:
        """검증한 입력. 버전이 다르거나 변경 번호가 겹치면 ValueError.

        주요 사건과 같은 후보 규칙(ADR-0051)으로 고른 변경의 이전·이번 글을 근거 원문으로 만든다.
        """
        if self.prompt_version != PROMPT_VERSION:
            raise ValueError(
                f"프롬프트 버전이 다릅니다(요청 {self.prompt_version}, AI 서버 {PROMPT_VERSION})."
            )
        nos = [c.change_no for c in self.changes]
        if len(set(nos)) != len(nos):
            raise ValueError("changeNo가 겹칩니다.")
        candidates = sorted((c for c in self.changes if is_candidate(_candidate(c))), key=_priority)
        sources: list[Source] = []
        seen: set[str] = set()
        for change in candidates:
            for side, evidence_id, text in (
                (PREVIOUS, change.previous_evidence_id, change.previous_text),
                (CURRENT, change.current_evidence_id, change.current_text),
            ):
                # 한 블록이 여러 변경에 걸리면 처음 것만 근거로 쓴다
                if evidence_id and text and text.strip() and evidence_id not in seen:
                    seen.add(evidence_id)
                    sources.append(
                        Source(
                            evidence_id,
                            change.change_no,
                            side,
                            change.section_path,
                            change.field,
                            change.change_type,
                            text[:TEXT_LIMIT],
                        )
                    )
        return ActivityInput(
            self.company_name,
            self.previous_report_name,
            self.current_report_name,
            sources[:MAX_SOURCES],
            len(candidates),
        )


def _priority(change: ChangeModel) -> int:
    """원문 수 제한에 걸릴 때 먼저 넣을 변경: 주요 분야·주석에서 올린 변경, 새 문단, 나머지 순."""
    if change.raised_from_note or change.field in PRIORITY_FIELDS:
        return 0
    return 1 if change.change_type == ADDED else 2


def _candidate(change: ChangeModel) -> CandidateChange:
    return CandidateChange(
        change.change_type,
        change.block_type,
        change.list_group,
        change.field,
        change.raised_from_note,
        change.section_path,
    )


def output_json(output: ActivityOutput) -> dict[str, Any]:
    result = output.result
    overview = result.overview
    return {
        "promptVersion": output.prompt_version,
        "expressionRulesVersion": RULESET_VERSION,
        "signalTableVersion": load_table().version,
        "model": output.model,
        "generatedAt": output.generated_at,
        "status": result.status,
        "overview": (
            {"text": overview.text, "evidenceIds": list(overview.evidence_ids)}
            if overview
            else None
        ),
        "items": [
            {
                "area": a.area,
                "audiences": list(a.audiences),
                "title": a.title,
                "summary": a.summary,
                "facts": [{"quote": f.quote, "evidenceId": f.evidence_id} for f in a.facts],
                "signal": a.signal.signal,
                "holdReason": a.signal.hold_reason,
                "signalKind": a.signal.kind_code,
                "signalKindName": a.signal.kind_name,
                "signalChange": a.signal.change_code,
                "signalChangeName": a.signal.change_name,
                "signalEvidenceId": a.signal.evidence_id,
                "impacts": [
                    {
                        "kind": i.kind,
                        "tone": i.tone,
                        "text": i.text,
                        "premises": [
                            {"quote": p.quote, "evidenceId": p.evidence_id} for p in i.premises
                        ],
                    }
                    for i in a.impacts
                ],
                "changeNos": list(a.change_nos),
            }
            for a in result.items
        ],
        "droppedCount": result.dropped_count,
        "candidateCount": output.candidate_count,
        "reviewReason": result.review_reason,
        "blockedRules": result.blocked_rules,
        "calls": [c.to_dict() for c in output.calls],
    }
