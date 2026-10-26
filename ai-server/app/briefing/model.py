"""AI 기업 브리핑(1.2) 입력·결과. 근거 원문은 backend가 보고서 하나에서 고른 블록이다."""

from __future__ import annotations

from dataclasses import dataclass, field

# 브리핑 상태(docs/api-spec.md POST /internal/briefings)
GENERATED = "GENERATED"
REVIEW_NEEDED = "REVIEW_NEEDED"

# 근거 주제(backend BriefingSources와 같은 값)
OVERVIEW = "OVERVIEW"
PRODUCTS = "PRODUCTS"
SALES = "SALES"
RISK = "RISK"
TOPICS = (OVERVIEW, PRODUCTS, SALES, RISK)

MAX_SOURCES = 8


@dataclass(frozen=True)
class Source:
    """근거 후보 원문 블록 하나. evidence_id는 저장된 원문 위치(`{접수번호}#B{블록 번호}`)다."""

    evidence_id: str
    topic: str
    section_path: str
    text: str


@dataclass(frozen=True)
class BriefingInput:
    company_name: str
    report_name: str
    sources: list[Source]


@dataclass(frozen=True)
class Sentence:
    text: str
    evidence_ids: list[str]


@dataclass(frozen=True)
class BriefingResult:
    status: str
    sentences: list[Sentence] = field(default_factory=list)
    review_reason: str | None = None
    blocked_rules: list[str] = field(default_factory=list)
