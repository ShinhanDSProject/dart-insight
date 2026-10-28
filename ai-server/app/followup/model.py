"""약속과 실제 대조(1.10) 입력·결과.

후보 원문은 backend가 계획마다 올해 사업보고서에서 고른 문단이다.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# 결과 상태(docs/api-spec.md POST /internal/plan-followups)
GENERATED = "GENERATED"
REVIEW_NEEDED = "REVIEW_NEEDED"

# 계획 하나의 대조 상태(backend FollowupStatus와 같은 값)
MENTIONED = "MENTIONED"
CHANGED = "CHANGED"
NOT_FOUND = "NOT_FOUND"
FOLLOWUP_STATUSES = (MENTIONED, CHANGED, NOT_FOUND)

# 계획으로 쓰는 종류. 시장·업황 전망(MARKET)은 회사가 할 일이 아니라서 받지 않는다
PLAN_CATEGORIES = ("INVESTMENT", "NEW_BUSINESS", "FINANCIAL", "OTHER")

MAX_PLANS = 10
MAX_CANDIDATES = 3


@dataclass(frozen=True)
class Source:
    """올해 보고서 후보 문단 하나. evidence_id는 저장된 원문 위치(`{접수번호}#B{블록 번호}`)다."""

    evidence_id: str
    section_path: str
    text: str


@dataclass(frozen=True)
class Plan:
    """작년 보고서의 회사 행동 계획 하나(요지는 FS-59 AI 요지, 인용은 원문)와 올해 후보 문단."""

    plan_id: str
    category: str
    summary: str
    quote: str
    candidates: list[Source]


@dataclass(frozen=True)
class FollowupInput:
    company_name: str
    previous_report_name: str
    current_report_name: str
    plans: list[Plan]


@dataclass(frozen=True)
class Followup:
    """계획 하나의 대조. NOT_FOUND면 summary·quote는 None, evidence_ids는 빈 목록이다."""

    plan_id: str
    status: str
    summary: str | None
    quote: str | None
    evidence_ids: list[str]


@dataclass(frozen=True)
class FollowupResult:
    status: str
    followups: list[Followup] = field(default_factory=list)
    review_reason: str | None = None
    blocked_rules: list[str] = field(default_factory=list)
