"""문장 변경의 목록 분류(2.10, ADR-0047). 변경을 기본 목록과 접는 묶음으로 나누고 분야를 정한다.

잠정 규칙이다(LIST_VERSION). 변경 유형·위치·우선순위는 바꾸지 않고, 접은 변경도 지우지 않는다.
판정은 저장된 전체 글과 섹션 경로로 하고 LLM을 쓰지 않는다. 분야는 목차 제목으로 나눈 것이라
실제 내용과 다를 수 있다. 좋고 나쁨을 판단하지 않는다.

묶음은 아래 순서로 처음 맞는 것이다.
1. 짝을 정하지 못한 항목(UNPAIRED). 건수에 세지 않지만 접지 않는다.
2. 위치 이동(MOVED).
3. 재무제표 주석: 소송·우발부채·담보·채무보증·보고기간 후 사건이 글이나 섹션 경로에 있으면
   기본 목록으로 올리고, 그 밖은 접는다(NOTE). 숫자만 바뀐 변경과 잡음은 올리지 않는다.
4. 잡음: 띄어쓰기·문장부호만 다른 수정(FORMATTING), 글자가 적은 추가·삭제(HEADING).
   값이 있는 행이 둘 이상인 표는 글자가 적어도 제목 줄로 보지 않는다.
5. 그 밖은 기본 목록(MAIN).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.compare.text_diff import (
    ADDED,
    DELETED,
    MODIFIED,
    MOVED,
    NUMERIC_UPDATE,
    REVIEW_NEEDED,
    Change,
    DocumentIn,
    section_paths,
)
from app.documents.parser import TABLE

# 결과가 달라지게 바꾸면 이 버전과 backend Analysis.CURRENT_VERSION을 함께 올린다
LIST_VERSION = "text-list-1"

MAIN = "MAIN"
HEADING = "HEADING"
FORMATTING = "FORMATTING"
GROUP_MOVED = "MOVED"
NOTE = "NOTE"
UNPAIRED = "UNPAIRED"

LITIGATION = "LITIGATION"
CONTRACT = "CONTRACT"
BUSINESS = "BUSINESS"
DIVIDEND = "DIVIDEND"
FUNDING = "FUNDING"
BOARD = "BOARD"
SHAREHOLDER = "SHAREHOLDER"
AUDIT = "AUDIT"
OTHER = "OTHER"

CONSOLIDATED = "CONSOLIDATED"
SEPARATE = "SEPARATE"
UNKNOWN = "UNKNOWN"

# 추가·삭제된 글의 글자(숫자·기호 제외)가 이보다 적으면 제목 줄로 본다
HEADING_MIN_LETTERS = 20

# 표기 비교에서 건너뛰는 글자. 뜻이 달라지는 기호와 표 칸 구분(|)은 남기고, 글머리표 -는 건너뛴다.
# 위치 이동 판정(text_diff.formatting_only_differs)은 숫자를 가린 글을 글자 단위로 맞춰 따로 둔다
_SKIPPED_IN_FORMATTING = re.compile(r"[^\w△▲▼+\-%$₩○×|]|_|(?<!\w)-")
_NOT_LETTER = re.compile(r"[\W\d_]+")
_WORD_CHAR = re.compile(r"[^\W_]")
# 주석에서 올리는 말과 올린 뒤의 분야. 여러 말이 있으면 앞의 것이다
_RAISED_FROM_NOTE: list[tuple[re.Pattern[str], str]] = [
    (re.compile("소송|우발부채"), LITIGATION),
    (re.compile("(?<!무)담보|채무보증"), FUNDING),
    (re.compile("보고기간 ?후"), OTHER),
]
# (섹션 경로에서 공백을 뺀 글에 있는 말, 최상위 섹션의 시작, 분야). 앞의 규칙부터 맞춰 본다
_FIELD_RULES: list[tuple[tuple[str, ...], tuple[str, ...], str]] = [
    (("우발부채", "제재"), (), LITIGATION),
    (("주요계약",), (), CONTRACT),
    ((), ("II. ", "IV. ", "IX. "), BUSINESS),
    (("배당에관한",), (), DIVIDEND),
    (("자금조달",), ("III. ",), FUNDING),
    ((), ("VI. ", "VIII. "), BOARD),
    (("주식의총수",), (), SHAREHOLDER),
    ((), ("VII. ", "X. "), SHAREHOLDER),
    ((), ("V. ",), AUDIT),
]
_SECTION_FIELDS = [
    LITIGATION,
    CONTRACT,
    BUSINESS,
    DIVIDEND,
    FUNDING,
    BOARD,
    SHAREHOLDER,
    AUDIT,
]


@dataclass(frozen=True)
class ListEntry:
    group: str
    field: str | None = None
    raised_from_note: bool = False
    note_scope: str | None = None


def classify(change: Change, previous_text: str | None, current_text: str | None) -> ListEntry:
    path = change.section_path
    scope = _note_scope(path)
    if change.change_type == REVIEW_NEEDED:
        return ListEntry(UNPAIRED, note_scope=scope)
    if change.change_type == MOVED:
        return ListEntry(GROUP_MOVED, note_scope=scope)

    previous, current = previous_text or "", current_text or ""
    noise = _noise_group(change, previous, current)
    if scope is not None:
        field = None
        if noise is None and change.change_type != NUMERIC_UPDATE:
            field = _raised_field(f"{previous}\n{current}\n{path}")
        if field is None:
            return ListEntry(NOTE, note_scope=scope)
        return ListEntry(MAIN, field, raised_from_note=True, note_scope=scope)
    if noise is not None:
        return ListEntry(noise)
    return ListEntry(MAIN, field_for_path(path))


def field_for_path(section_path: str) -> str:
    key = section_path.replace(" ", "")
    top = section_path.split(" > ")[0]
    for words, starts, field in _FIELD_RULES:
        word_hit = not words or any(word in key for word in words)
        start_hit = not starts or top.startswith(starts)
        if word_hit and start_hit:
            return field
    return OTHER


def missing_fields(previous: DocumentIn, current: DocumentIn) -> list[str]:
    """두 보고서 어느 쪽에도 섹션이 없는 분야. 그 밖의 변경(OTHER)은 넣지 않는다."""
    found = {field_for_path(path) for path in section_paths(previous) + section_paths(current)}
    return [field for field in _SECTION_FIELDS if field not in found]


def _noise_group(change: Change, previous: str, current: str) -> str | None:
    if change.change_type == MODIFIED and _same_apart_from_formatting(previous, current):
        return FORMATTING
    if change.change_type in (ADDED, DELETED):
        text = previous or current
        short = len(_NOT_LETTER.sub("", text)) < HEADING_MIN_LETTERS
        if short and not (change.block_type == TABLE and _has_several_rows(text)):
            return HEADING
    return None


def _same_apart_from_formatting(previous: str, current: str) -> bool:
    return _SKIPPED_IN_FORMATTING.sub("", previous) == _SKIPPED_IN_FORMATTING.sub("", current)


def _has_several_rows(table_text: str) -> bool:
    return sum(1 for row in table_text.split("\n") if _WORD_CHAR.search(row)) >= 2


def _note_scope(section_path: str) -> str | None:
    key = section_path.replace(" ", "")
    if "주석" not in key:
        return None
    if "연결재무제표주석" in key:
        return CONSOLIDATED
    return SEPARATE if "재무제표주석" in key else UNKNOWN


def _raised_field(text: str) -> str | None:
    for pattern, field in _RAISED_FROM_NOTE:
        if pattern.search(text):
            return field
    return None
