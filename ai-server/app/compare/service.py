"""문장·표 변경 탐지(2.5), 확인 우선순위(2.6), 목록 분류·표 행 비교(2.10·2.11)를 부르는 흐름."""

from __future__ import annotations

from dataclasses import dataclass

from app.compare.listing import ListEntry, list_entries, missing_fields
from app.compare.priority import Priority, prioritize
from app.compare.text_diff import DiffResult, DocumentIn, diff_documents


@dataclass(frozen=True)
class TextChanges:
    """변경 탐지 결과와 변경 항목마다의 우선순위·목록 분류(changes와 같은 순서)."""

    result: DiffResult
    priorities: list[Priority]
    entries: list[ListEntry]
    missing_fields: list[str]


def compare_documents(previous: DocumentIn, current: DocumentIn) -> TextChanges:
    result = diff_documents(previous, current)
    previous_texts = {b.block_no: b.text for b in previous.blocks}
    current_texts = {b.block_no: b.text for b in current.blocks}
    priorities: list[Priority] = []
    for change in result.changes:
        previous_text = previous_texts.get(change.previous.block_no) if change.previous else None
        current_text = current_texts.get(change.current.block_no) if change.current else None
        priorities.append(prioritize(change, previous_text, current_text))
    entries = list_entries(result.changes, previous_texts, current_texts)
    return TextChanges(result, priorities, entries, missing_fields(previous, current))
