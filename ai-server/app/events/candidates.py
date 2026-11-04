"""주요 사건의 후보 고르기(2.14, ADR-0051).

코드가 규칙으로 후보를 골라, AI가 놓친 변경을 대조할 수 있게 한다. 잠정 규칙이다(CANDIDATE_VERSION).
우선순위 점수(priority.py)와 LLM을 쓰지 않는다. 좋고 나쁨을 판단하지 않는다.

입력은 MAIN·UNPAIRED·HEADING 묶음이고, 아래 중 하나에 맞으면 후보다.
1. 짝을 정하지 못한 항목, 제목 줄, 재무제표 주석에서 올린 변경
2. 분야가 소송·제재, 주요 계약, 자금 조달, 배당, 감사인 변경
3. 섹션 경로에 '작성기준일 이후', '회사의 연혁'이 있는 변경
4. 새로 추가된 문단
"""

from __future__ import annotations

from dataclasses import dataclass

from app.compare.listing import (
    AUDIT,
    CONTRACT,
    DIVIDEND,
    FUNDING,
    HEADING,
    LITIGATION,
    MAIN,
    UNPAIRED,
)
from app.compare.text_diff import ADDED
from app.documents.parser import PARAGRAPH

# 결과가 달라지게 바꾸면 이 버전과 backend TextEvents.EVENT_VERSION을 함께 올린다
CANDIDATE_VERSION = "event-candidate-1"

_INPUT_GROUPS = frozenset({MAIN, UNPAIRED, HEADING})
_ALWAYS_GROUPS = frozenset({UNPAIRED, HEADING})
_FOCUS_FIELDS = frozenset({LITIGATION, CONTRACT, FUNDING, DIVIDEND, AUDIT})
# 섹션 경로에서 공백을 뺀 글에 있는 말
_FOCUS_SECTIONS = ("작성기준일이후", "회사의연혁")


@dataclass(frozen=True)
class CandidateChange:
    change_type: str
    block_type: str
    group: str
    field: str | None
    raised_from_note: bool
    section_path: str


def is_candidate(change: CandidateChange) -> bool:
    if change.group not in _INPUT_GROUPS:
        return False
    key = "".join(change.section_path.split())
    return (
        change.group in _ALWAYS_GROUPS
        or change.raised_from_note
        or change.field in _FOCUS_FIELDS
        or any(section in key for section in _FOCUS_SECTIONS)
        or (change.change_type == ADDED and change.block_type == PARAGRAPH)
    )


def select_candidates(changes: list[CandidateChange]) -> list[CandidateChange]:
    """후보만 남긴다(입력 순서 유지)."""
    return [change for change in changes if is_candidate(change)]
