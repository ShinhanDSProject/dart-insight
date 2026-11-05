"""주요 사건 묶기의 내부 값(2.15, ADR-0050)."""

from __future__ import annotations

from dataclasses import dataclass, field

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
# 순서의 기준
FRONT_KIND = "FRONT_KIND"
AMOUNT = "AMOUNT"
UNIT_COUNT = "UNIT_COUNT"
# 금액을 정한 방법
STRUCTURED = "structured"
SINGLE_CANDIDATE = "single_candidate"
AI_CHOICE = "ai_choice"
RULE_FALLBACK = "rule_fallback"
AMOUNT_NONE = "none"
# 금액은 있는데 비율을 계산하지 못한 사유
EQUITY_MISSING = "EQUITY_MISSING"
EQUITY_NOT_POSITIVE = "EQUITY_NOT_POSITIVE"
FX_RATE_MISSING = "FX_RATE_MISSING"


@dataclass(frozen=True)
class EventChange:
    change_no: int
    attrs: CandidateChange
    previous_block_no: int | None
    current_block_no: int | None
    previous_text: str | None
    current_text: str | None
    # 표의 바뀐 행 + 바뀐 문단, 각 1. backend가 계산한다
    changed_unit_count: int = 0
    # 표 바로 앞 블록의 글. 단위를 읽는다
    preceding_block_text: str | None = None

    def block_no(self, side: str) -> int | None:
        return self.previous_block_no if side == PREVIOUS else self.current_block_no

    def text(self, side: str) -> str | None:
        """모델에 넣는 글. 인용은 이 글로 대조한다."""
        text = self.previous_text if side == PREVIOUS else self.current_text
        return text[:TEXT_LIMIT] if text else None


@dataclass(frozen=True)
class StructuredAmount:
    """OpenDART 주요사항보고서의 결정 하나의 금액. backend가 받아 넘긴다."""

    rcept_no: str
    kind: str
    field: str
    amount: int
    currency: str


@dataclass(frozen=True)
class EventInput:
    previous_rcept_no: str
    current_rcept_no: str
    changes: list[EventChange]
    equity_total: int | None = None
    currency: str | None = None
    report_base_date: str | None = None
    structured_amounts: list[StructuredAmount] = field(default_factory=list)

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
class EventScale:
    """사건의 규모. 숫자는 코드가 만든다. 사건끼리 더하지 않는다."""

    amount: int | None = None
    text: str | None = None
    currency: str | None = None
    krw: int | None = None
    ratio: float | None = None
    reason: str | None = None
    evidence_id: str | None = None
    source: str = AMOUNT_NONE
    fx_source: str | None = None
    fx_rate_date: str | None = None


@dataclass(frozen=True)
class TextEvent:
    title: str
    kind: str
    change_nos: list[int]
    quotes: list[Quote]
    scale: EventScale = EventScale()
    basis: str = UNIT_COUNT
