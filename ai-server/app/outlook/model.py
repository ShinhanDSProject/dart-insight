"""회사가 밝힌 전망·계획(1.9) 입력·결과. 근거 원문은 backend가 사업보고서 하나에서 고른 문단이다."""

from __future__ import annotations

from dataclasses import dataclass, field

# 결과 상태(docs/api-spec.md POST /internal/outlooks)
GENERATED = "GENERATED"
EMPTY = "EMPTY"
REVIEW_NEEDED = "REVIEW_NEEDED"

# 항목 종류(backend OutlookCategory와 같은 값)
INVESTMENT = "INVESTMENT"
NEW_BUSINESS = "NEW_BUSINESS"
MARKET = "MARKET"
FINANCIAL = "FINANCIAL"
OTHER = "OTHER"
CATEGORIES = (INVESTMENT, NEW_BUSINESS, MARKET, FINANCIAL, OTHER)

MAX_SOURCES = 12


@dataclass(frozen=True)
class Source:
    """근거 후보 원문 문단 하나. evidence_id는 저장된 원문 위치(`{접수번호}#B{블록 번호}`)다."""

    evidence_id: str
    section_path: str
    text: str


@dataclass(frozen=True)
class OutlookInput:
    company_name: str
    report_name: str
    sources: list[Source]


@dataclass(frozen=True)
class Item:
    category: str
    summary: str
    quote: str
    evidence_ids: list[str]


@dataclass(frozen=True)
class OutlookResult:
    status: str
    items: list[Item] = field(default_factory=list)
    review_reason: str | None = None
    blocked_rules: list[str] = field(default_factory=list)
