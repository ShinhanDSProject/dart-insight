"""사건 문장 단계(2.22, ADR-0060). 묶기와 금액 확인이 끝난 뒤 사건마다 부른다.

- 최대 MAX_CONCURRENT_CALLS개를 동시에 부르고, 결과와 호출 기록은 사건 순서대로 돌려준다.
- 시간 예산(SENTENCE_BUDGET_SECONDS)을 넘긴 뒤 시작할 사건은 부르지 않고 BUDGET_EXCEEDED로 남긴다.
- LLM을 쓸 수 없다고 판명되면 아직 시작하지 않은 사건은 부르지 않고 LLM_UNAVAILABLE로 남긴다.
- 문장 하나가 실패해도 사건 묶기 전체는 실패하지 않는다.
요청의 추적 ID(contextvars)가 호출 기록에 남도록 작업마다 요청의 문맥을 복사해 실행한다.
"""

from __future__ import annotations

import contextvars
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

from app.events.meaning import Written, not_written, write_meaning
from app.events.model import BUDGET_EXCEEDED, LLM_UNAVAILABLE, EventInput, TextEvent
from app.llm import CallRecord, LlmClient

SENTENCE_BUDGET_SECONDS = 300.0
MAX_CONCURRENT_CALLS = 4


def write_sentences(
    llm: LlmClient,
    data: EventInput,
    events: list[TextEvent],
    monotonic: Callable[[], float] = time.monotonic,
    workers: int = MAX_CONCURRENT_CALLS,
) -> tuple[list[TextEvent], list[CallRecord]]:
    if not events:
        return [], []
    started = monotonic()
    down = threading.Event()

    def one(event: TextEvent) -> Written:
        if down.is_set():
            return Written(not_written(LLM_UNAVAILABLE))
        if monotonic() - started >= SENTENCE_BUDGET_SECONDS:
            return Written(not_written(BUDGET_EXCEEDED))
        written = write_meaning(llm, event, data)
        if written.unavailable:
            down.set()
        return written

    with ThreadPoolExecutor(max_workers=min(workers, MAX_CONCURRENT_CALLS)) as pool:
        futures = [pool.submit(contextvars.copy_context().run, one, e) for e in events]
        results = [f.result() for f in futures]
    written = [replace(e, meaning=r.sentence) for e, r in zip(events, results, strict=True)]
    return written, [c for r in results for c in r.calls]
