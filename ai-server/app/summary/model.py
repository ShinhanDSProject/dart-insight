"""요약(3.2) 입력·결과. 숫자는 backend 코드가 계산한 값이고, LLM은 문장만 쓴다."""

from __future__ import annotations

from dataclasses import dataclass, field

TEXT = "TEXT"
FINANCIAL = "FINANCIAL"

OK = "OK"
REVIEW_NEEDED = "REVIEW_NEEDED"

# 재무 수치 변화 방향(FinancialItem.direction, backend가 보낸 값)
UP = "UP"
DOWN = "DOWN"

# 재무 설명 등급(ADR-0015). 코드는 등급을 낮추기만 한다
STATED = "STATED"  # 회사가 변화의 원인을 직접 밝힘
RELATED = "RELATED"  # 관련 내용은 있지만 원인을 말하지 않음
NONE = "NONE"  # 확인된 설명 없음
GRADES = (STATED, RELATED, NONE)


@dataclass(frozen=True)
class Source:
    """근거 후보 원문 한 덩어리. evidence_id는 저장된 원문 위치(`{접수번호}#B{블록 번호}`)다."""

    evidence_id: str
    section_path: str
    text: str


@dataclass(frozen=True)
class TextItem:
    """문장 변화 하나. LLM이 무엇이 바뀌었는지 한 문장으로 쓴다."""

    ref: str
    change_type: str
    section_path: str
    sources: list[Source]


@dataclass(frozen=True)
class FinancialItem:
    """재무 수치 변화 하나.

    사실 문장은 backend가 코드로 만든다. LLM은 설명 후보 원문이 그 변화를 설명할 때만 한 문장으로
    요약한다. 후보가 없으면 LLM을 부르지 않고 '확인된 설명 없음'이다.
    """

    ref: str
    account_name: str
    direction: str | None
    # 보고서 문단에서 검색으로 고른 설명 후보(ADR-0036, search.Index.candidates)
    candidates: list[Source]
    # 설명 후보를 찾을 검색어(backend가 만듦, ADR-0015). 후보 검색과 인용 확인(#142)에 쓴다
    account_aliases: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class SummaryInput:
    company_name: str
    previous_report: str
    current_report: str
    text_items: list[TextItem]
    financial_items: list[FinancialItem]


@dataclass(frozen=True)
class ItemResult:
    ref: str
    kind: str
    status: str
    sentence: str | None = None
    explanation: str | None = None
    evidence_ids: list[str] = field(default_factory=list)
    review_reason: str | None = None
    blocked_rules: list[str] = field(default_factory=list)
    # 재무 설명만. 문장 변화와 '검토 필요' 항목은 None
    grade: str | None = None
    quote: str | None = None
    quote_evidence_id: str | None = None
