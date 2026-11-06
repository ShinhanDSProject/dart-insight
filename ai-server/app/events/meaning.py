"""사건마다 '공시의 의미' 쓰기와 검증(2.22, ADR-0060). LLM은 app.llm.LlmClient로만 부른다.

코드가 문장마다 확인한다(근거·사실·원인 표현·투자 권유성 표현은 sentence_checks.py).
- '없음' 문장(ABSENT)은 없다고 쓴 항목이 있고, 확인한 범위(근거 블록)에 정말 없다.
  금액은 금액 표현이 없고 코드가 정한 사건 금액도 없어야 하며, 일정은 날짜가 없어야 한다.
FACT 문장이 하나 이상 있어야 한다. 하나라도 통과하지 못하면 문제를 알려 주며 최대 2회 다시 만들고,
그래도 실패하면 문장 없이 FAILED로 남긴다. 사건 묶기 전체의 실패가 되지 않는다.
"""

from __future__ import annotations

from typing import Any

from app.events.amounts import AmountSource, extract_amounts
from app.events.facts import has_date
from app.events.meaning_prompt import MAX_ITEMS, Block, build_request, code_values, event_blocks
from app.events.model import (
    ABSENT,
    ABSENT_TOPICS,
    FACT,
    FAILED,
    MEANING_TYPES,
    TOPIC_AMOUNT,
    TOPIC_SCHEDULE,
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
from app.llm import CallRecord, LlmClient, OutputProblem


def not_written(reason: str, calls: list[CallRecord] | None = None) -> EventSentence:
    """문장 없음. 부른 적이 있으면 마지막 호출의 모델·시각을 남긴다."""
    return EventSentence(FAILED, fail_reason=reason, **last_call(calls or []))


def write_meaning(llm: LlmClient, event: TextEvent, data: EventInput) -> Written:
    blocks = event_blocks(event, data)

    def validate(output: object) -> tuple[SentenceItem, ...]:
        return check_meaning(output, event, blocks, data)

    request = build_request(event, blocks, code_values(event, data))
    return call_sentence(llm, request, validate, not_written)


def check_meaning(
    output: Any, event: TextEvent, blocks: list[Block], data: EventInput
) -> tuple[SentenceItem, ...]:
    """통과한 문장들. 하나라도 문제가 있으면 OutputProblem(LLM에 알려 줄 문장)."""
    entries = entries_of(output)
    if entries is None:
        raise OutputProblem(["items 배열이 있는 JSON 객체가 필요합니다."])
    if not 1 <= len(entries) <= MAX_ITEMS:
        raise OutputProblem([f"문장은 1개 이상 {MAX_ITEMS}개 이하여야 합니다."])
    by_id = {b.evidence_id: b for b in blocks}
    values = " ".join(code_values(event, data).values())
    items: list[SentenceItem] = []
    problems: list[str] = []
    for no, entry in enumerate(entries, start=1):
        result = _item(entry, by_id, values, event)
        if isinstance(result, str):
            problems.append(f"{no}번 문장: {result}")
        else:
            items.append(result)
    if not problems and not any(i.type == FACT for i in items):
        problems.append("공시에 적힌 사실과 뜻을 쓴 FACT 문장이 하나 이상 있어야 합니다.")
    if problems:
        raise OutputProblem(problems)
    return tuple(items)


def _item(entry: Any, by_id: dict[str, Block], values: str, event: TextEvent) -> SentenceItem | str:
    if not isinstance(entry, dict):
        return "type·absentTopics·text·evidenceIds가 있는 객체여야 합니다."
    kind = entry.get("type")
    if kind not in MEANING_TYPES:
        return f"type은 {', '.join(MEANING_TYPES)} 중 하나여야 합니다."
    text = text_of(entry)
    if text is None:
        return TEXT_PROBLEM
    cited = cited_of(entry, by_id)
    if cited is None:
        return EVIDENCE_PROBLEM
    topics = _topics(entry.get("absentTopics"), kind)
    if isinstance(topics, str):
        return topics
    problem = text_problem(text, cited, values) or _absent_problem(topics, cited, event)
    if problem:
        return problem
    return SentenceItem(kind, text, tuple(b.evidence_id for b in cited), topics)


def _topics(value: Any, kind: str) -> tuple[str, ...] | str:
    if not isinstance(value, list) or not all(t in ABSENT_TOPICS for t in value):
        return f"absentTopics는 {', '.join(ABSENT_TOPICS)} 중에서 고른 배열이어야 합니다."
    if kind == FACT and value:
        return "FACT 문장의 absentTopics는 빈 배열이어야 합니다."
    if kind == ABSENT and not value:
        return "ABSENT 문장은 absentTopics에 없다고 쓴 항목을 하나 이상 적어야 합니다."
    return tuple(dict.fromkeys(value))


def _absent_problem(topics: tuple[str, ...], cited: list[Block], event: TextEvent) -> str | None:
    """'없음' 문장이 확인한 범위에 정말 그것이 없는지."""
    if TOPIC_AMOUNT in topics:
        extracted = extract_amounts(
            [
                AmountSource(b.change_no, b.evidence_id, b.text, b.is_table, b.preceding_text)
                for b in cited
            ]
        )
        if event.scale.amount is not None or extracted.candidates or extracted.excluded:
            return "근거로 든 원문에 금액이 적혀 있는데 금액이 없다고 했습니다. 빼거나 고치세요."
    if TOPIC_SCHEDULE in topics and any(has_date(b.text) for b in cited):
        return "근거로 든 원문에 날짜가 적혀 있는데 일정이 없다고 했습니다. 빼거나 고치세요."
    return None
