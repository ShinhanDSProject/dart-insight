"""주요 사건 묶기의 내부 값(2.15, ADR-0050)."""

from __future__ import annotations

from dataclasses import dataclass

from app.events.candidates import CandidateChange, is_candidate

# 변경마다 모델에 넣는 글자 수. 인용 검증도 이 글로 한다(ADR-0050 가정 3)
TEXT_LIMIT = 1500
# docs/erd.md의 text_event 칸 길이
MAX_TITLE_CHARS = 200
MAX_KIND_CHARS = 30

# 인용의 쓰임
CHANGE = "CHANGE"
REASON = "REASON"
PURPOSES = (CHANGE, REASON)
# 인용을 옮긴 쪽
PREVIOUS = "PREVIOUS"
CURRENT = "CURRENT"
SIDES = (PREVIOUS, CURRENT)
# 사건을 만들지 않은 사유
FAKE_MODEL = "FAKE_MODEL"
NO_CANDIDATES = "NO_CANDIDATES"


@dataclass(frozen=True)
class EventChange:
    change_no: int
    attrs: CandidateChange
    previous_block_no: int | None
    current_block_no: int | None
    previous_text: str | None
    current_text: str | None

    def block_no(self, side: str) -> int | None:
        return self.previous_block_no if side == PREVIOUS else self.current_block_no

    def text(self, side: str) -> str | None:
        """모델에 넣는 글. 인용은 이 글로 대조한다."""
        text = self.previous_text if side == PREVIOUS else self.current_text
        return text[:TEXT_LIMIT] if text else None


@dataclass(frozen=True)
class EventInput:
    previous_rcept_no: str
    current_rcept_no: str
    changes: list[EventChange]

    @property
    def candidates(self) -> list[EventChange]:
        return [c for c in self.changes if is_candidate(c.attrs)]

    def rcept_no(self, side: str) -> str:
        return self.previous_rcept_no if side == PREVIOUS else self.current_rcept_no


@dataclass(frozen=True)
class Quote:
    change_no: int
    purpose: str
    side: str
    text: str
    evidence_id: str


@dataclass(frozen=True)
class TextEvent:
    title: str
    kind: str
    change_nos: list[int]
    quotes: list[Quote]
