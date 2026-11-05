"""주요 사건 내부 API의 요청·응답 모양(camelCase)."""

from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.events.candidates import CandidateChange
from app.events.model import EventChange, EventInput, TextEvent
from app.events.service import EventOutput

# 규모와 정렬은 2.16에서 코드가 정한다. 그 전에는 규모 없이 이 기준으로 답한다
ROW_COUNT = "ROW_COUNT"


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


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


class TextEventRequest(_Model):
    previous_rcept_no: str
    current_rcept_no: str
    # 자본총계와 통화는 정렬(2.16)에 쓴다
    equity_total: int | None
    currency: str | None
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
                )
                for c in self.changes
            ],
        )


def _event_json(sort_order: int, event: TextEvent) -> dict[str, Any]:
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
        "scaleAmount": None,
        "currency": None,
        "scaleEvidenceId": None,
        "sortBasis": ROW_COUNT,
    }


def output_json(output: EventOutput) -> dict[str, Any]:
    return {
        "created": output.created,
        "notCreatedReason": output.not_created_reason,
        "model": output.model,
        "promptVersion": output.prompt_version,
        "generatedAt": output.generated_at,
        "droppedEventCount": output.dropped_event_count,
        "events": [_event_json(no, e) for no, e in enumerate(output.events, start=1)],
        "unboundChangeNos": output.unbound_change_nos,
        "calls": [c.to_dict() for c in output.calls],
    }
