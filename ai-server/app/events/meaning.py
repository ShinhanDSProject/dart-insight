"""사건마다 '공시의 의미' 쓰기와 검증(2.22, ADR-0060). LLM은 app.llm.LlmClient로만 부른다.

코드가 문장마다 확인한다.
- 근거 ID가 하나 이상이고 모두 그 사건에 묶인 변경의 블록이다.
- 금액·날짜·사건번호·회사 이름·건수·비율이 그 문장이 근거로 든 블록이나 코드 값에 있다(facts.py).
- '없음' 문장(ABSENT)은 없다고 쓴 항목이 있고, 확인한 범위(근거 블록)에 정말 없다.
  금액은 금액 표현이 없고 코드가 정한 사건 금액도 없어야 하며, 일정은 날짜가 없어야 한다.
- 원인 표현은 근거 블록에도 원인 표현이 있을 때만 쓴다.
- 투자 권유성 표현 검사(app.compliance)를 통과한다.
FACT 문장이 하나 이상 있어야 한다. 하나라도 통과하지 못하면 문제를 알려 주며 최대 2회 다시 만들고,
그래도 실패하면 문장 없이 FAILED로 남긴다. 사건 묶기 전체의 실패가 되지 않는다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.compliance import scan
from app.events.amounts import AmountSource, extract_amounts
from app.events.facts import fact_problem, has_date
from app.events.meaning_prompt import (
    MAX_ITEMS,
    MAX_SENTENCE_CHARS,
    Block,
    build_request,
    code_values,
    event_blocks,
)
from app.events.model import (
    ABSENT,
    ABSENT_TOPICS,
    FACT,
    FAILED,
    GENERATED,
    INVALID_OUTPUT,
    LLM_UNAVAILABLE,
    MEANING_TYPES,
    TOPIC_AMOUNT,
    TOPIC_SCHEDULE,
    EventInput,
    EventSentence,
    SentenceItem,
    TextEvent,
)
from app.llm import CallRecord, LlmClient, LlmOutputInvalid, LlmUnavailable, OutputProblem
from app.llm.client import OUTCOME_ERROR, OUTCOME_TRANSIENT_ERROR
from app.summary.causal import find as find_causal


@dataclass(frozen=True)
class Written:
    sentence: EventSentence
    calls: list[CallRecord] = field(default_factory=list)
    # LLM을 쓸 수 없다고 판명됨. 뒤 사건은 부르지 않는다
    unavailable: bool = False


def not_written(reason: str, calls: list[CallRecord] | None = None) -> EventSentence:
    """문장 없음. 부른 적이 있으면 마지막 호출의 모델·시각을 남긴다."""
    last = calls[-1] if calls else None
    return EventSentence(
        FAILED,
        fail_reason=reason,
        model=last.model if last else None,
        prompt_version=last.prompt_version if last else None,
        generated_at=last.called_at if last else None,
    )


def write_meaning(llm: LlmClient, event: TextEvent, data: EventInput) -> Written:
    blocks = event_blocks(event, data)
    values = code_values(event, data)

    def validate(output: object) -> tuple[SentenceItem, ...]:
        return check_meaning(output, event, blocks, data)

    try:
        generated = llm.generate(build_request(event, blocks, values), validate)
    except LlmOutputInvalid as e:
        # 다시 만들다 호출이 실패해도 이 예외로 온다. 그때는 LLM을 쓸 수 없는 것이다
        failed = bool(e.calls) and e.calls[-1].outcome in (OUTCOME_ERROR, OUTCOME_TRANSIENT_ERROR)
        reason = LLM_UNAVAILABLE if failed else INVALID_OUTPUT
        return Written(not_written(reason, e.calls), e.calls, unavailable=failed)
    except LlmUnavailable as e:
        return Written(not_written(LLM_UNAVAILABLE, e.calls), e.calls, unavailable=True)
    sentence = EventSentence(
        GENERATED,
        generated.value,
        model=generated.model,
        prompt_version=generated.prompt_version,
        generated_at=generated.generated_at,
    )
    return Written(sentence, generated.calls)


def check_meaning(
    output: Any, event: TextEvent, blocks: list[Block], data: EventInput
) -> tuple[SentenceItem, ...]:
    """통과한 문장들. 하나라도 문제가 있으면 OutputProblem(LLM에 알려 줄 문장)."""
    if not isinstance(output, dict) or not isinstance(output.get("items"), list):
        raise OutputProblem(["items 배열이 있는 JSON 객체가 필요합니다."])
    entries = output["items"]
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
    text = entry.get("text").strip() if isinstance(entry.get("text"), str) else ""
    if not text or len(text) > MAX_SENTENCE_CHARS:
        return f"text는 1자 이상 {MAX_SENTENCE_CHARS}자 이하여야 합니다."
    ids = entry.get("evidenceIds")
    if not isinstance(ids, list) or not ids or not all(i in by_id for i in ids):
        return "evidenceIds에는 <disclosure>의 id만 하나 이상 적어야 합니다."
    evidence_ids = tuple(dict.fromkeys(ids))
    topics = _topics(entry.get("absentTopics"), kind)
    if isinstance(topics, str):
        return topics
    cited = [by_id[i] for i in evidence_ids]
    source = " ".join([*(b.text for b in cited), values])
    problem = (
        fact_problem(text, source)
        or _causal_problem(text, cited)
        or _advice_problem(text)
        or _absent_problem(topics, cited, event)
    )
    if problem:
        return problem
    return SentenceItem(kind, text, evidence_ids, topics)


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


def _causal_problem(text: str, cited: list[Block]) -> str | None:
    claim = find_causal(text)
    if claim and not find_causal(" ".join(b.text for b in cited)):
        return f"원인 표현('{claim}')은 원문이 원인을 직접 밝혔을 때만 씁니다."
    return None


def _advice_problem(text: str) -> str | None:
    findings = scan(text)
    if not findings:
        return None
    labels = ", ".join(dict.fromkeys(f.label for f in findings))
    return f"투자 권유로 읽힐 수 있는 표현이 있습니다({labels}). 공시에 적힌 사실만 쓰세요."
