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
# 요약·타임라인 입력(ADR-0068)
MAX_FINANCIALS = 20
MAX_DISCLOSURES = 80
DISCLOSURE_TEXT_LIMIT = 1500


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
class FinancialFact:
    """코드가 계산한 재무 수치 문장. evidence_id는 `F{financial_change.id}`다."""

    evidence_id: str
    text: str


@dataclass(frozen=True)
class DisclosureFact:
    """사이 기간 공시. evidence_id는 `D{접수번호}`다. 원문이 없으면 text는 빈 글이다."""

    evidence_id: str
    rcept_dt: str
    report_name: str
    text: str


@dataclass(frozen=True)
class ActivityInput:
    company_name: str
    previous_report_name: str
    current_report_name: str
    sources: list[Source]
    # 후보 규칙으로 고른 변경 수(입력에 든 변경 수와 다를 수 있음, 원문 수 제한)
    candidate_count: int = 0
    # 비교 기간(YYYY-MM-DD). 타임라인 날짜가 이 안에 있어야 한다
    period_from: str = ""
    period_to: str = ""
    financials: list[FinancialFact] = field(default_factory=list)
    disclosures: list[DisclosureFact] = field(default_factory=list)


@dataclass(frozen=True)
class OverviewContext:
    """요약·타임라인 호출의 입력. sources는 그 호출에 넣을 보고서 문단이다."""

    activity: ActivityInput
    sources: list[Source]


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
class TimelineEntry:
    date: str
    text: str
    evidence_ids: tuple[str, ...]


@dataclass(frozen=True)
class OverviewResult:
    overview: Overview | None = None
    timeline: list[TimelineEntry] = field(default_factory=list)


@dataclass(frozen=True)
class ActivityResult:
    status: str
    overview: Overview | None = None
    items: list[Activity] = field(default_factory=list)
    dropped_count: int = 0
    review_reason: str | None = None
    blocked_rules: list[str] = field(default_factory=list)
    timeline: list[TimelineEntry] = field(default_factory=list)
