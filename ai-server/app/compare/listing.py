"""문장 변경의 목록 분류와 표 행 비교(2.10·2.11, ADR-0047).

변경을 기본 목록과 접는 묶음으로 나누고 분야를 정하며, 표는 값이 겹치지 않는 열로 행끼리 비교한다.
잠정 규칙이다(LIST_VERSION). 변경 유형·위치·우선순위는 바꾸지 않고, 접은 변경도 지우지 않는다.
판정은 저장된 전체 글과 섹션 경로로 하고 LLM을 쓰지 않는다. 분야는 목차 제목으로 나눈 것이라
실제 내용과 다를 수 있다. 좋고 나쁨을 판단하지 않는다.

묶음은 아래 순서로 처음 맞는 것이다.
1. 짝을 정하지 못한 항목(UNPAIRED). 건수에 세지 않지만 접지 않는다.
2. 위치 이동(MOVED).
3. 추가된 표와 짝지어 행 비교가 된 삭제된 표(PAIRED_TABLE). 결과는 추가된 표 쪽에 둔다.
4. 재무제표 주석: 소송·우발부채·담보·채무보증·보고기간 후 사건이 글이나 섹션 경로에 있으면
   기본 목록으로 올리고, 그 밖은 접는다(NOTE). 숫자만 바뀐 변경과 잡음은 올리지 않는다.
5. 잡음: 띄어쓰기·문장부호만 다른 수정(FORMATTING), 글자가 적은 추가·삭제(HEADING).
   값이 있는 행이 둘 이상인 표는 글자가 적어도 제목 줄로 보지 않는다.
6. 그 밖은 기본 목록(MAIN).
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass, replace

from app.compare.text_diff import (
    ADDED,
    DELETED,
    MODIFIED,
    MOVED,
    NUMERIC_UPDATE,
    REVIEW_NEEDED,
    Change,
    DocumentIn,
    Position,
    section_paths,
)
from app.documents.parser import TABLE

# 결과가 달라지게 바꾸면 이 버전과 backend Analysis.CURRENT_VERSION을 함께 올린다
LIST_VERSION = "text-list-1"

MAIN = "MAIN"
HEADING = "HEADING"
FORMATTING = "FORMATTING"
GROUP_MOVED = "MOVED"
PAIRED_TABLE = "PAIRED_TABLE"
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

COMPARED = "COMPARED"
NOT_COMPARED = "NOT_COMPARED"

# 표 글에서 칸을 나누는 글(줄이 행이다)
_CELL_SEPARATOR = " | "

# 추가·삭제된 글의 글자(숫자·기호 제외)가 이보다 적으면 제목 줄로 본다
HEADING_MIN_LETTERS = 20

# 표기 비교에서 건너뛰는 글자. 뜻이 달라지는 기호와 표 칸 구분(|)은 남기고, 글머리표 -는 건너뛴다.
# 위치 이동 판정(text_diff.formatting_only_differs)은 숫자를 가린 글을 글자 단위로 맞춰 따로 둔다
_SKIPPED_IN_FORMATTING = re.compile(r"[^\w△▲▼+\-%$₩○×|]|_|(?<!\w)-")
_NOT_LETTER = re.compile(r"[\W\d_]+")
_WORD_CHAR = re.compile(r"[^\W_]")
# 행을 가리키지 못하는 숫자 값(1,000 (200) 30.5% △50). 2025.01.01 같은 날짜는 맞지 않는다
_AMOUNT = re.compile(r"[-+△▲▼(]?\d[\d,]*(?:\.\d+)?[)%]?")
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
class RowCounts:
    changed: int
    added: int
    missing: int
    same: int


@dataclass(frozen=True)
class CellChange:
    column: str
    previous: str
    current: str


@dataclass(frozen=True)
class ChangedRow:
    key: str
    cells: list[CellChange]


@dataclass(frozen=True)
class RowDiff:
    """표 행 비교 결과. NOT_COMPARED면 값들은 None이거나 비어 있다."""

    status: str
    key_column: str | None
    counts: RowCounts | None
    paired_previous: Position | None
    changed_rows: list[ChangedRow]
    added_keys: list[str]
    missing_keys: list[str]


@dataclass(frozen=True)
class ListEntry:
    group: str
    field: str | None = None
    raised_from_note: bool = False
    note_scope: str | None = None
    row_diff: RowDiff | None = None


@dataclass(frozen=True)
class _ParsedTable:
    header: list[str]
    rows: list[list[str]]


def list_entries(
    changes: list[Change], previous_texts: dict[int, str], current_texts: dict[int, str]
) -> list[ListEntry]:
    """변경마다의 묶음·분야와 표 행 비교(changes와 같은 순서)."""
    texts = [_change_texts(c, previous_texts, current_texts) for c in changes]
    deleted_of_added = _pair_tables(changes, texts)
    paired_deleted = set(deleted_of_added.values())
    entries: list[ListEntry] = []
    for i, (change, (previous, current)) in enumerate(zip(changes, texts, strict=True)):
        if i in paired_deleted:
            entries.append(ListEntry(PAIRED_TABLE, note_scope=_note_scope(change.section_path)))
            continue
        entry = classify(change, previous, current)
        if i in deleted_of_added:
            partner = deleted_of_added[i]
            diff = compare_table_rows(texts[partner][0], current, changes[partner].previous)
            entry = replace(entry, row_diff=diff)
        elif change.block_type == TABLE and previous is not None and current is not None:
            entry = replace(entry, row_diff=compare_table_rows(previous, current))
        entries.append(entry)
    return entries


def compare_table_rows(
    previous_text: str, current_text: str, paired_previous: Position | None = None
) -> RowDiff:
    """값이 겹치지 않는 공통 열로 행을 짝짓는다. 열을 정할 수 없으면 짝을 추측하지 않는다."""
    previous, current = _parse_table(previous_text), _parse_table(current_text)
    key = _key_column(previous, current) if previous and current else None
    if previous is None or current is None or key is None:
        return RowDiff(NOT_COMPARED, None, None, None, [], [], [])

    previous_rows = _rows_by_value(previous, key) or {}
    current_rows = _rows_by_value(current, key) or {}
    columns = [c for c in _common_columns(previous, current) if c != key]
    changed: list[ChangedRow] = []
    same = 0
    for value, row in current_rows.items():
        if value not in previous_rows:
            continue
        before = dict(zip(previous.header, previous_rows[value], strict=True))
        after = dict(zip(current.header, row, strict=True))
        cells = [
            CellChange(column, before[column], after[column])
            for column in columns
            if _compact(before[column]) != _compact(after[column])
        ]
        if cells:
            changed.append(ChangedRow(after[key], cells))
        else:
            same += 1
    added = [
        row[current.header.index(key)] for v, row in current_rows.items() if v not in previous_rows
    ]
    missing = [
        row[previous.header.index(key)] for v, row in previous_rows.items() if v not in current_rows
    ]
    counts = RowCounts(len(changed), len(added), len(missing), same)
    return RowDiff(COMPARED, key, counts, paired_previous, changed, added, missing)


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


def _change_texts(
    change: Change, previous_texts: dict[int, str], current_texts: dict[int, str]
) -> tuple[str | None, str | None]:
    previous = previous_texts.get(change.previous.block_no) if change.previous else None
    current = current_texts.get(change.current.block_no) if change.current else None
    return previous, current


def _pair_tables(
    changes: list[Change], texts: list[tuple[str | None, str | None]]
) -> dict[int, int]:
    """구성이 바뀐 표의 짝(추가된 변경의 순번 → 삭제된 변경의 순번).

    같은 섹션에서 머리글이 같고 짝지을 열이 있는 것끼리 함께 있는 값이 많은 쌍부터 정하고,
    같으면 이전 표, 현재 표의 문서 순서를 따른다. 표 하나는 한 쌍에만 들어간다.
    """
    deleted: dict[str, list[tuple[int, _ParsedTable]]] = defaultdict(list)
    added: dict[str, list[tuple[int, _ParsedTable]]] = defaultdict(list)
    for i, (change, (previous, current)) in enumerate(zip(changes, texts, strict=True)):
        if change.block_type != TABLE:
            continue
        if change.change_type == DELETED and previous is not None:
            side, text = deleted, previous
        elif change.change_type == ADDED and current is not None:
            side, text = added, current
        else:
            continue
        table = _parse_table(text)
        if table is not None:
            side[change.section_path].append((i, table))

    candidates: list[tuple[int, int, int, int, int]] = []
    for path, deleted_tables in deleted.items():
        for d, previous_table in deleted_tables:
            for a, current_table in added.get(path, []):
                if _header_key(previous_table) != _header_key(current_table):
                    continue
                key = _key_column(previous_table, current_table)
                if key is None:
                    continue
                shared = _shared_values(previous_table, current_table, key)
                candidates.append(
                    (-shared, _document_order(changes[d]), _document_order(changes[a]), d, a)
                )

    pairs: dict[int, int] = {}
    used_deleted: set[int] = set()
    for _, _, _, d, a in sorted(candidates):
        if d not in used_deleted and a not in pairs:
            pairs[a] = d
            used_deleted.add(d)
    return pairs


def _document_order(change: Change) -> int:
    position = change.previous or change.current
    return position.block_no or 0 if position else 0


def _parse_table(text: str) -> _ParsedTable | None:
    """표 글을 행과 칸으로 나눈다. 값 행이 없거나 칸 수가 맞지 않으면 None."""
    lines = [[cell.strip() for cell in line.split(_CELL_SEPARATOR)] for line in text.split("\n")]
    if len(lines) < 2 or any(len(line) != len(lines[0]) for line in lines):
        return None
    return _ParsedTable(lines[0], lines[1:])


def _key_column(previous: _ParsedTable, current: _ParsedTable) -> str | None:
    """값이 겹치지 않고 비어 있지 않은 공통 열 중 함께 있는 값이 가장 많은 열(같으면 앞쪽)."""
    best, best_shared = None, 0
    for column in _common_columns(previous, current):
        shared = _shared_values(previous, current, column)
        if shared > best_shared:
            best, best_shared = column, shared
    return best


def _common_columns(previous: _ParsedTable, current: _ParsedTable) -> list[str]:
    """양쪽에 이름이 한 번씩만 있는 열(이전 표의 순서)."""
    previous_counts, current_counts = Counter(previous.header), Counter(current.header)
    return [
        column
        for column in previous.header
        if column and previous_counts[column] == 1 and current_counts[column] == 1
    ]


def _shared_values(previous: _ParsedTable, current: _ParsedTable, column: str) -> int:
    """이 열로 행을 짝지을 때 양쪽에 함께 있는 값의 수. 열이 키가 될 수 없으면 0."""
    previous_rows = _rows_by_value(previous, column)
    current_rows = _rows_by_value(current, column)
    if previous_rows is None or current_rows is None:
        return 0
    return len(previous_rows.keys() & current_rows.keys())


def _rows_by_value(table: _ParsedTable, column: str) -> dict[str, list[str]] | None:
    """열의 값으로 찾는 행(띄어쓰기를 뺀 값 기준). 짝지을 수 없는 값이 있거나 겹치면 None."""
    index = table.header.index(column)
    rows = {_compact(row[index]): row for row in table.rows}
    if len(rows) != len(table.rows) or not all(_can_identify_row(value) for value in rows):
        return None
    return rows


def _can_identify_row(value: str) -> bool:
    """비었거나 -뿐인 값, 금액·비율처럼 숫자뿐인 값은 행을 가리키지 못한다."""
    return bool(_WORD_CHAR.search(value)) and not _AMOUNT.fullmatch(value)


def _header_key(table: _ParsedTable) -> list[str]:
    return [_compact(cell) for cell in table.header]


def _compact(value: str) -> str:
    return "".join(value.split())


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
