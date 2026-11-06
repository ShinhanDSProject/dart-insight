"""사건마다 '신호 이유' 쓰기와 검증(2.23, ADR-0060). LLM은 app.llm.LlmClient로만 부른다.

신호 이유는 모드(signal_reason_prompt.mode_of)에 맞는 종류와 개수만 받는다.
근거·사실·원인 표현·투자 권유성 표현은 공시의 의미와 같이 확인한다(sentence_checks.py).
하나라도 통과하지 못하면 문제를 알려 주며 최대 2회 다시 만들고, 그래도 실패하거나 부르지 못하면
대체 표시(FALLBACK)로 남긴다. AI 문장이 아니라 기준표의 일반 문구다.
- 주의·긍정: 그 변화의 일반 문구(general) 하나
- 좋은 면·나쁜 면이 함께 있는 보류: 종류의 일반 문구(generalSides) 좋은 면, 나쁜 면 순서
- 섞인 소송: 문구 없음. 화면은 판정 줄과 행 수만 보인다
"""

from __future__ import annotations

from typing import Any

from app.events.meaning_prompt import Block, code_values, event_blocks
from app.events.model import (
    FALLBACK,
    GENERAL,
    EventInput,
    EventSentence,
    SentenceItem,
    TextEvent,
)
from app.events.sentence_checks import (
    EVIDENCE_PROBLEM,
    TEXT_PROBLEM,
    Written,
    call_sentence,
    cited_of,
    entries_of,
    last_call,
    text_of,
    text_problem,
)
from app.events.signal_reason_prompt import (
    REASON_COUNT,
    REASONS,
    SIDE_COUNT,
    SIDES_OF_HOLD,
    WHY_HOLD_COUNT,
    build_request,
    mode_of,
    written_types,
)
from app.events.signals import SignalTable, load_table
from app.llm import CallRecord, LlmClient, OutputProblem

_COUNTS = {REASONS: REASON_COUNT, SIDES_OF_HOLD: SIDE_COUNT}


def fallback(
    event: TextEvent,
    reason: str,
    calls: list[CallRecord] | None = None,
    table: SignalTable | None = None,
) -> EventSentence:
    """기준표의 일반 문구. 근거가 없는 코드 문구이고 AI 생성이 아니다."""
    table = table or load_table()
    mode = mode_of(event)
    signal = event.signal
    kind = table.kind(signal.kind_code if signal else None)
    texts: list[str] = []
    if kind and signal and mode == REASONS:
        change = kind.change(signal.change_code)
        texts = [change.general] if change and change.general else []
    elif kind and mode == SIDES_OF_HOLD and kind.general_sides:
        texts = [kind.general_sides["good"], kind.general_sides["bad"]]
    items = tuple(SentenceItem(GENERAL, t, ()) for t in texts)
    return EventSentence(FALLBACK, items, reason, **last_call(calls or []))


def write_signal_reason(
    llm: LlmClient, event: TextEvent, data: EventInput, table: SignalTable | None = None
) -> Written:
    table = table or load_table()
    blocks = event_blocks(event, data)

    def validate(output: object) -> tuple[SentenceItem, ...]:
        return check_reason(output, event, blocks, data)

    def failed(reason: str, calls: list[CallRecord]) -> EventSentence:
        return fallback(event, reason, calls, table)

    request = build_request(event, blocks, code_values(event, data), table)
    return call_sentence(llm, request, validate, failed)


def check_reason(
    output: Any, event: TextEvent, blocks: list[Block], data: EventInput
) -> tuple[SentenceItem, ...]:
    """통과한 문장들. 하나라도 문제가 있으면 OutputProblem(LLM에 알려 줄 문장)."""
    mode = mode_of(event)
    assert mode is not None
    entries = entries_of(output)
    if entries is None:
        raise OutputProblem(["items 배열이 있는 JSON 객체가 필요합니다."])
    allowed = written_types(mode)
    by_id = {b.evidence_id: b for b in blocks}
    values = " ".join(code_values(event, data).values())
    items: list[SentenceItem] = []
    problems: list[str] = []
    for no, entry in enumerate(entries, start=1):
        result = _item(entry, allowed, by_id, values)
        if isinstance(result, str):
            problems.append(f"{no}번 문장: {result}")
        else:
            items.append(result)
    if not problems:
        problems += _count_problems(items, mode, allowed)
    if problems:
        raise OutputProblem(problems)
    return tuple(items)


def _item(
    entry: Any, allowed: tuple[str, ...], by_id: dict[str, Block], values: str
) -> SentenceItem | str:
    if not isinstance(entry, dict):
        return "type·text·evidenceIds가 있는 객체여야 합니다."
    kind = entry.get("type")
    if kind not in allowed:
        return f"이 사건의 type은 {', '.join(allowed)}만 쓸 수 있습니다."
    text = text_of(entry)
    if text is None:
        return TEXT_PROBLEM
    cited = cited_of(entry, by_id)
    if cited is None:
        return EVIDENCE_PROBLEM
    problem = text_problem(text, cited, values)
    if problem:
        return problem
    return SentenceItem(kind, text, tuple(b.evidence_id for b in cited))


def _count_problems(items: list[SentenceItem], mode: str, allowed: tuple[str, ...]) -> list[str]:
    low, high = _COUNTS.get(mode, WHY_HOLD_COUNT)
    problems = []
    for kind in allowed:
        count = sum(1 for i in items if i.type == kind)
        if not low <= count <= high:
            problems.append(f"{kind} 문장은 {low}~{high}개여야 합니다(지금 {count}개).")
    return problems
