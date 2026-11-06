"""주요 사건 묶기의 내부 값(2.15, ADR-0050)."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.events.candidates import CandidateChange, is_candidate

# 변경마다 모델에 넣는 글자 수. 인용 검증도 이 글로 한다(ADR-0050 가정 3)
TEXT_LIMIT = 1500
# docs/erd.md의 text_event 칸 길이
MAX_TITLE_CHARS = 200

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
AI_CHOICE = "ai_choice"
AMOUNT_NONE = "none"
# 호출 실패, 읽을 수 없는 답, 시간 예산 초과로 확인하지 못함
AMOUNT_UNAVAILABLE = "unavailable"
# 금액은 있는데 비율을 계산하지 못한 사유
EQUITY_MISSING = "EQUITY_MISSING"
EQUITY_NOT_POSITIVE = "EQUITY_NOT_POSITIVE"
FX_RATE_MISSING = "FX_RATE_MISSING"
# 사건 신호(ADR-0060). 코드가 기준표(signal_table.json)로 붙인다
CAUTION = "CAUTION"
POSITIVE = "POSITIVE"
HOLD = "HOLD"
# 보류 사유
NO_CRITERIA = "NO_CRITERIA"
EVIDENCE_NOT_CONFIRMED = "EVIDENCE_NOT_CONFIRMED"
MIXED_SIDES = "MIXED_SIDES"
MIXED_LITIGATION = "MIXED_LITIGATION"
# 공시의 의미 문장의 종류(ADR-0060). ABSENT는 공시에 없는 것을 적은 '없음' 문장이다
FACT = "FACT"
ABSENT = "ABSENT"
MEANING_TYPES = (FACT, ABSENT)
# '없음' 문장이 없다고 쓴 항목
TOPIC_AMOUNT = "AMOUNT"
TOPIC_SCHEDULE = "SCHEDULE"
TOPIC_PNL_IMPACT = "PNL_IMPACT"
TOPIC_FOLLOW_UP = "FOLLOW_UP"
TOPIC_BURDEN = "BURDEN"
ABSENT_TOPICS = (TOPIC_AMOUNT, TOPIC_SCHEDULE, TOPIC_PNL_IMPACT, TOPIC_FOLLOW_UP, TOPIC_BURDEN)
# 신호 이유 문장의 종류. 주의·긍정은 REASON(인용의 쓰임 REASON과 같은 값), 좋은 면·나쁜 면이
# 함께 있는 보류는 GOOD·BAD, 섞인 소송은 WHY_HOLD, 대체 표시의 일반 문구는 GENERAL이다
GOOD = "GOOD"
BAD = "BAD"
WHY_HOLD = "WHY_HOLD"
GENERAL = "GENERAL"
REASON_TYPES = (REASON, GOOD, BAD, WHY_HOLD)
# 사건 문장의 상태와 실패 사유
GENERATED = "GENERATED"
FALLBACK = "FALLBACK"
FAILED = "FAILED"
INVALID_OUTPUT = "INVALID_OUTPUT"
LLM_UNAVAILABLE = "LLM_UNAVAILABLE"
BUDGET_EXCEEDED = "BUDGET_EXCEEDED"


@dataclass(frozen=True)
class RowCounts:
    """표 변경의 행 비교(rowDiff.counts). backend가 계산한다."""

    changed: int
    added: int
    missing: int

    @property
    def total(self) -> int:
        return self.changed + self.added + self.missing


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
    # 행을 비교한 표만. 그 밖에는 None
    row_counts: RowCounts | None = None

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
class SignalPick:
    """AI가 고른 종류·변화와 그 근거. 코드가 아직 확인하지 않은 값이다.

    evidence_id는 AI가 가리킨 변경·쪽으로 코드가 만든 근거 ID이고, 가리킬 수 없으면 None이다.
    """

    kind_code: str | None = None
    change_code: str | None = None
    side: str | None = None
    evidence_id: str | None = None


@dataclass(frozen=True)
class FactAccount:
    """사실 칸에 보일 계정 이름(기준표). 값은 backend가 채운다."""

    account_name: str
    account_type: str | None = None


@dataclass(frozen=True)
class EventSignal:
    """기준표로 붙인 신호. AI가 정하지 않는다(ADR-0060)."""

    kind_code: str
    change_code: str
    change_name: str
    signal: str
    hold_reason: str | None = None
    evidence_id: str | None = None
    # 맨 앞 종류가 새로 발생했고 근거를 확인함
    front: bool = False
    fact_accounts: tuple[FactAccount, ...] = ()


@dataclass(frozen=True)
class GlossaryTerm:
    """기준표의 용어 풀이. 출처(source)를 확인한 것만 사건에 붙인다."""

    term: str
    meaning: str
    source: str | None


@dataclass(frozen=True)
class SentenceItem:
    """사건 문장 하나. 근거 ID는 그 사건에 묶인 변경의 블록이다."""

    type: str
    text: str
    evidence_ids: tuple[str, ...]
    absent_topics: tuple[str, ...] = ()


@dataclass(frozen=True)
class EventSentence:
    """사건 문장 칸 하나(공시의 의미 등). model·prompt_version·generated_at은 마지막 호출이다."""

    status: str
    items: tuple[SentenceItem, ...] = ()
    fail_reason: str | None = None
    model: str | None = None
    prompt_version: str | None = None
    generated_at: str | None = None


@dataclass(frozen=True)
class TextEvent:
    title: str
    kind: str
    change_nos: list[int]
    quotes: list[Quote]
    scale: EventScale = EventScale()
    basis: str = UNIT_COUNT
    pick: SignalPick = SignalPick()
    signal: EventSignal | None = None
    meaning: EventSentence | None = None
    # 신호 이유. 주의·긍정이거나 MIXED_SIDES·MIXED_LITIGATION 보류일 때만 있다
    signal_reason: EventSentence | None = None
    glossary: tuple[GlossaryTerm, ...] = ()
