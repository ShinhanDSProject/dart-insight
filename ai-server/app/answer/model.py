"""질문 답변(3.10) 입력·결과. 사실 문장의 숫자는 backend 코드가 계산한 값이고, LLM은 문장만 쓴다."""

from __future__ import annotations

from dataclasses import dataclass, field

# 답 상태(docs/api-spec.md POST /internal/answers)
ANSWERED = "ANSWERED"
NOT_FOUND = "NOT_FOUND"
OUT_OF_SCOPE = "OUT_OF_SCOPE"
REVIEW_NEEDED = "REVIEW_NEEDED"
# LLM이 고를 수 있는 상태
LLM_STATUSES = (ANSWERED, NOT_FOUND)
# 이유를 묻는 질문에 원문이 이유를 직접 밝히지 않았을 때 코드가 답 끝에 붙이는 문장(#601)
REASON_NOT_STATED = "원문에서 이유를 직접 밝힌 문장은 찾지 못했어요."


@dataclass(frozen=True)
class Source:
    """후보 원문 문단 하나. evidence_id는 저장된 원문 위치(`{접수번호}#B{블록 번호}`)다."""

    evidence_id: str
    side: str  # previous, current
    section_path: str
    text: str


@dataclass(frozen=True)
class Fact:
    """backend 코드가 만든 사실 문장(계정 변화). ref는 `F1`처럼 답에서 인용할 이름이다."""

    ref: str
    sentence: str


@dataclass(frozen=True)
class AnswerInput:
    """previous_report가 None이면 보고서 하나(기업 단위 질문, FS-53)이고 후보는 모두 current다."""

    company_name: str
    previous_report: str | None
    current_report: str
    question: str
    facts: list[Fact]
    sources: list[Source]


@dataclass(frozen=True)
class AnswerResult:
    status: str
    answer: str | None = None
    evidence_ids: list[str] = field(default_factory=list)
    fact_refs: list[str] = field(default_factory=list)
    review_reason: str | None = None
    blocked_rules: list[str] = field(default_factory=list)
