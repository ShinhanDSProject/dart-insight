"""주요 사건 내부 API의 요청·응답 모양(camelCase)."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.events.candidates import CandidateChange
from app.events.model import EventChange, EventInput, RowCounts, StructuredAmount, TextEvent
from app.events.service import EventOutput
from app.events.signals import load_table


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RowCountsModel(_Model):
    changed: int = Field(ge=0)
    added: int = Field(ge=0)
    missing: int = Field(ge=0)


class ChangeModel(_Model):
    change_no: int
    change_type: str
    block_type: str
    list_group: str
    field: str | None
    raised_from_note: bool
    section_path: str
    previous_block_no: int | None
    current_block_no: int | None
    previous_text: str | None
    current_text: str | None
    changed_unit_count: int = Field(ge=0)
    preceding_block_text: str | None = None
    # 표 변경의 바뀐·새·이번엔 없는 행 수. 소송이 섞였는지 본다(ADR-0060)
    row_counts: RowCountsModel | None = None


class StructuredAmountModel(_Model):
    rcept_no: str
    kind: str
    field: str
    amount: int
    currency: str


class TextEventRequest(_Model):
    previous_rcept_no: str
    current_rcept_no: str
    equity_total: int | None
    currency: str | None
    report_base_date: str | None = None
    structured_amounts: list[StructuredAmountModel] = []
    changes: list[ChangeModel]

    def to_input(self) -> EventInput:
        """검증한 입력. changeNo가 겹치면 ValueError."""
        numbers = [c.change_no for c in self.changes]
        if len(set(numbers)) != len(numbers):
            raise ValueError("changeNo가 겹칩니다.")
        return EventInput(
            self.previous_rcept_no,
            self.current_rcept_no,
            [
                EventChange(
                    c.change_no,
                    CandidateChange(
                        c.change_type,
                        c.block_type,
                        c.list_group,
                        c.field,
                        c.raised_from_note,
                        c.section_path,
                    ),
                    c.previous_block_no,
                    c.current_block_no,
                    c.previous_text,
                    c.current_text,
                    c.changed_unit_count,
                    c.preceding_block_text,
                    (
                        RowCounts(c.row_counts.changed, c.row_counts.added, c.row_counts.missing)
                        if c.row_counts
                        else None
                    ),
                )
                for c in self.changes
            ],
            self.equity_total,
            self.currency,
            self.report_base_date,
            [
                StructuredAmount(s.rcept_no, s.kind, s.field, s.amount, s.currency)
                for s in self.structured_amounts
            ],
        )


def _row_counts(event: TextEvent, changes: dict[int, EventChange]) -> dict[str, int] | None:
    """사건에 묶인 표의 행 수 합. 행 수가 있는 변경이 없으면 null."""
    counts = [
        changes[no].row_counts for no in event.change_nos if changes[no].row_counts is not None
    ]
    if not counts:
        return None
    return {
        "changed": sum(c.changed for c in counts),
        "added": sum(c.added for c in counts),
        "missing": sum(c.missing for c in counts),
    }


def _event_json(
    sort_order: int, event: TextEvent, changes: dict[int, EventChange]
) -> dict[str, Any]:
    signal = event.signal
    assert signal is not None
    return {
        "sortOrder": sort_order,
        "title": event.title,
        "kind": event.kind,
        "changeNos": event.change_nos,
        "quotes": [
            {
                "changeNo": q.change_no,
                "purpose": q.purpose,
                "side": q.side,
                "text": q.text,
                "evidenceId": q.evidence_id,
            }
            for q in event.quotes
        ],
        "scaleAmount": event.scale.amount,
        "scaleAmountText": event.scale.text,
        "currency": event.scale.currency,
        "scaleAmountKrw": event.scale.krw,
        "scaleRatio": event.scale.ratio,
        "scaleNotComputedReason": event.scale.reason,
        "scaleEvidenceId": event.scale.evidence_id,
        "amountSource": event.scale.source,
        "fxSource": event.scale.fx_source,
        "fxRateDate": event.scale.fx_rate_date,
        "sortBasis": event.basis,
        "kindCode": signal.kind_code,
        "changeCode": signal.change_code,
        "changeName": signal.change_name,
        "signal": signal.signal,
        "holdReason": signal.hold_reason,
        "signalEvidenceId": signal.evidence_id,
        "rowCounts": _row_counts(event, changes),
        "factAccounts": [
            {"accountType": a.account_type, "accountName": a.account_name}
            for a in signal.fact_accounts
        ],
    }


def output_json(output: EventOutput, event_input: EventInput) -> dict[str, Any]:
    changes = {c.change_no: c for c in event_input.changes}
    return {
        "created": output.created,
        "notCreatedReason": output.not_created_reason,
        "model": output.model,
        "promptVersion": output.prompt_version,
        "generatedAt": output.generated_at,
        "signalTableVersion": load_table().version,
        "droppedEventCount": output.dropped_event_count,
        "events": [_event_json(no, e, changes) for no, e in enumerate(output.events, start=1)],
        "unboundChangeNos": output.unbound_change_nos,
        "calls": [c.to_dict() for c in output.calls],
    }
