"""문장·표 변경 탐지(2.5)와 확인 우선순위(2.6)를 차례로 부르는 흐름."""

from __future__ import annotations

from dataclasses import dataclass

from app.compare.priority import Priority, prioritize
from app.compare.text_diff import DiffResult, DocumentIn, diff_documents


@dataclass(frozen=True)
class TextChanges:
    """변경 탐지 결과와 변경 항목마다의 우선순위(changes와 같은 순서)."""

    result: DiffResult
    priorities: list[Priority]


def compare_documents(previous: DocumentIn, current: DocumentIn) -> TextChanges:
    result = diff_documents(previous, current)
    previous_texts = {b.block_no: b.text for b in previous.blocks}
    current_texts = {b.block_no: b.text for b in current.blocks}
    priorities = [
        prioritize(
            change,
            previous_texts.get(change.previous.block_no) if change.previous else None,
            current_texts.get(change.current.block_no) if change.current else None,
        )
        for change in result.changes
    ]
    return TextChanges(result, priorities)
