"""두 보고서 사이에 회사가 한 일과 앞으로의 영향(ADR-0067) 입력·결과."""

from __future__ import annotations

from dataclasses import dataclass, field

# 결과 상태(docs/api-spec.md POST /internal/period-activities)
GENERATED = "GENERATED"
EMPTY = "EMPTY"
REVIEW_NEEDED = "REVIEW_NEEDED"

# 분야. backend ActivityArea와 같은 값
BUSINESS = "BUSINESS"
INVESTMENT = "INVESTMENT"
FINANCE = "FINANCE"
SHAREHOLDER = "SHAREHOLDER"
GOVERNANCE = "GOVERNANCE"
PEOPLE = "PEOPLE"
RISK = "RISK"
OTHER = "OTHER"
AREAS = (BUSINESS, INVESTMENT, FINANCE, SHAREHOLDER, GOVERNANCE, PEOPLE, RISK, OTHER)

# 쓰임: 투자(주식·사모펀드·재무적 투자), 취업·면접, 협업·거래
INVESTOR = "INVESTOR"
CAREER = "CAREER"
PARTNER = "PARTNER"
AUDIENCES = (INVESTOR, CAREER, PARTNER)

# 앞으로의 영향 줄 종류. 표시는 코드가 붙인다
DISCLOSED = "DISCLOSED"
OUTLOOK = "OUTLOOK"
CHECK = "CHECK"
IMPACT_KINDS = (DISCLOSED, OUTLOOK, CHECK)
# AI 전망 줄의 좋은 면·나쁜 면. 없으면 None
GOOD = "GOOD"
BAD = "BAD"
TONES = (GOOD, BAD)

# 원문 쪽
PREVIOUS = "PREVIOUS"
CURRENT = "CURRENT"

# 신호(기준표, ADR-0060)
POSITIVE = "POSITIVE"
CAUTION = "CAUTION"
HOLD = "HOLD"
NO_CRITERIA = "NO_CRITERIA"
EVIDENCE_NOT_CONFIRMED = "EVIDENCE_NOT_CONFIRMED"
MIXED_SIDES = "MIXED_SIDES"

# 변경마다 모델에 넣는 글자 수. 인용 검증도 이 글로 한다
TEXT_LIMIT = 500
# 모델에 넣는 원문 수(변경 쪽 기준). 넘으면 앞에서 자른다
MAX_SOURCES = 160


@dataclass(frozen=True)
class Source:
    """근거 원문 하나. evidence_id는 저장된 원문 위치(`{접수번호}#B{블록 번호}`)다."""

    evidence_id: str
    change_no: int
    side: str
    section_path: str
    field: str | None
    change_type: str
    text: str


@dataclass(frozen=True)
class ActivityInput:
    company_name: str
    previous_report_name: str
    current_report_name: str
    sources: list[Source]
    # 후보 규칙으로 고른 변경 수(입력에 든 변경 수와 다를 수 있음, 원문 수 제한)
    candidate_count: int = 0


@dataclass(frozen=True)
class Quote:
    quote: str
    evidence_id: str


@dataclass(frozen=True)
class Impact:
    kind: str
    text: str
    tone: str | None = None
    premises: tuple[Quote, ...] = ()


@dataclass(frozen=True)
class Signal:
    signal: str
    kind_code: str
    change_code: str
    kind_name: str
    change_name: str
    hold_reason: str | None = None
    evidence_id: str | None = None


@dataclass(frozen=True)
class Activity:
    area: str
    audiences: tuple[str, ...]
    title: str
    summary: str
    facts: tuple[Quote, ...]
    impacts: tuple[Impact, ...]
    signal: Signal
    change_nos: tuple[int, ...]


@dataclass(frozen=True)
class Overview:
    text: str
    evidence_ids: tuple[str, ...]


@dataclass(frozen=True)
class ActivityResult:
    status: str
    overview: Overview | None = None
    items: list[Activity] = field(default_factory=list)
    dropped_count: int = 0
    review_reason: str | None = None
    blocked_rules: list[str] = field(default_factory=list)
