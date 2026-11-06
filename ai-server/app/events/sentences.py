"""사건 문장 단계(2.22·2.23, ADR-0060). 묶기와 금액 확인이 끝난 뒤 사건마다 부른다.

- 칸은 공시의 의미(모든 사건)와 신호 이유(주의·긍정이거나 MIXED_SIDES·MIXED_LITIGATION 보류)다.
- 최대 MAX_CONCURRENT_CALLS개를 동시에 부르고, 결과와 호출 기록은 사건 순서(사건마다 의미, 이유)로
  돌려준다.
- 시간 예산(SENTENCE_BUDGET_SECONDS)을 넘긴 뒤 시작할 칸은 부르지 않고 BUDGET_EXCEEDED로 남긴다.
- LLM을 쓸 수 없다고 판명되면 아직 시작하지 않은 칸은 부르지 않고 LLM_UNAVAILABLE로 남긴다.
- 부르지 못하거나 실패한 공시의 의미는 FAILED, 신호 이유는 기준표의 일반 문구(FALLBACK)다.
  문장 하나가 실패해도 사건 묶기 전체는 실패하지 않는다.
요청의 추적 ID(contextvars)가 호출 기록에 남도록 작업마다 요청의 문맥을 복사해 실행한다.
"""

from __future__ import annotations

import contextvars
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace

from app.events.meaning import not_written, write_meaning
from app.events.model import BUDGET_EXCEEDED, LLM_UNAVAILABLE, EventInput, TextEvent
from app.events.sentence_checks import Written
from app.events.signal_reason import fallback, write_signal_reason
from app.events.signal_reason_prompt import mode_of
from app.llm import CallRecord, LlmClient

SENTENCE_BUDGET_SECONDS = 300.0
MAX_CONCURRENT_CALLS = 4

_MEANING = "MEANING"
_SIGNAL_REASON = "SIGNAL_REASON"


@dataclass(frozen=True)
class _Cell:
    index: int
    part: str
    event: TextEvent


def write_sentences(
    llm: LlmClient,
    data: EventInput,
    events: list[TextEvent],
    monotonic: Callable[[], float] = time.monotonic,
    workers: int = MAX_CONCURRENT_CALLS,
) -> tuple[list[TextEvent], list[CallRecord]]:
    cells = [
        _Cell(i, part, e)
        for i, e in enumerate(events)
        for part in (_MEANING, _SIGNAL_REASON)
        if part == _MEANING or mode_of(e) is not None
    ]
    if not cells:
        return list(events), []
    started = monotonic()
    down = threading.Event()

    def skipped(cell: _Cell, reason: str) -> Written:
        if cell.part == _MEANING:
            return Written(not_written(reason))
        return Written(fallback(cell.event, reason))

    def one(cell: _Cell) -> Written:
        if down.is_set():
            return skipped(cell, LLM_UNAVAILABLE)
        if monotonic() - started >= SENTENCE_BUDGET_SECONDS:
            return skipped(cell, BUDGET_EXCEEDED)
        if cell.part == _MEANING:
            written = write_meaning(llm, cell.event, data)
        else:
            written = write_signal_reason(llm, cell.event, data)
        if written.unavailable:
            down.set()
        return written

    with ThreadPoolExecutor(max_workers=min(workers, MAX_CONCURRENT_CALLS)) as pool:
        futures = [pool.submit(contextvars.copy_context().run, one, c) for c in cells]
        results = [f.result() for f in futures]
    written = list(events)
    for cell, result in zip(cells, results, strict=True):
        field = "meaning" if cell.part == _MEANING else "signal_reason"
        written[cell.index] = replace(written[cell.index], **{field: result.sentence})
    return written, [c for r in results for c in r.calls]
