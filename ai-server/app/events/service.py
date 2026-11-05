"""문장 변경을 주요 사건으로 묶기(2.15, ADR-0050). LLM은 app.llm.LlmClient로만 부른다.

- 후보가 없거나 제공자가 fake면 LLM을 부르지 않고 만들지 않았다고 답한다.
- 결과를 검증(validate.check)하고, 실패하면 문제를 알려 주며 최대 2회 다시 만든다.
  그래도 잘못된 사건은 빼고 건수를 남기고, 그 변경은 묶이지 않은 후보로 돌아간다.
  쓸 수 있는 사건이 하나도 없으면 LlmOutputInvalid를 그대로 던진다(부른 쪽이 502로 바꿈).
- LLM을 부를 수 없으면(LlmUnavailable) 그대로 던진다(부른 쪽이 503으로 바꿈).
- 규모와 순서는 코드가 정한다(scales.py, ordering.py, ADR-0053).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.events.model import FAKE_MODEL, NO_CANDIDATES, EventInput, TextEvent
from app.events.ordering import rank
from app.events.prompt import PROMPT_VERSION, build_request
from app.events.scales import scale_events
from app.events.validate import check
from app.llm import CallRecord, LlmClient, LlmOutputInvalid, OutputProblem
from app.llm.client import OUTCOME_INVALID_OUTPUT
from app.llm.providers import FAKE_PROVIDER

logger = logging.getLogger("app.events")


@dataclass(frozen=True)
class EventOutput:
    created: bool
    not_created_reason: str | None = None
    model: str | None = None
    prompt_version: str = PROMPT_VERSION
    generated_at: str | None = None
    dropped_event_count: int = 0
    events: list[TextEvent] = field(default_factory=list)
    unbound_change_nos: list[int] = field(default_factory=list)
    calls: list[CallRecord] = field(default_factory=list)


def group_events(llm: LlmClient, event_input: EventInput) -> EventOutput:
    candidates = event_input.candidates
    if not candidates:
        return EventOutput(False, NO_CANDIDATES)
    if llm.provider is not None and llm.provider.name == FAKE_PROVIDER:
        return EventOutput(False, FAKE_MODEL)

    def validate(data: object) -> list[TextEvent]:
        checked = check(data, event_input)
        if checked.problems:
            raise OutputProblem(checked.problems)
        return checked.events

    dropped = 0
    try:
        generated = llm.generate(build_request(candidates), validate)
    except LlmOutputInvalid as e:
        checked = check(e.last_output, event_input)
        if not checked.events:
            raise
        dropped = len(checked.problems)
        logger.warning("검증에 실패한 사건 %d건을 뺌 prompt=%s", dropped, PROMPT_VERSION)
        # 다시 만드는 호출이 실패했을 수 있어, 사건을 만든 호출(검증 실패 기록)의 값을 쓴다
        source = next(c for c in reversed(e.calls) if c.outcome == OUTCOME_INVALID_OUTPUT)
        events, model, generated_at, calls = (
            checked.events,
            source.model,
            source.called_at,
            e.calls,
        )
    else:
        events, model, generated_at, calls = (
            generated.value,
            generated.model,
            generated.generated_at,
            generated.calls,
        )

    scaled, pick_calls = scale_events(llm, event_input, events)
    changes = {c.change_no: c for c in event_input.changes}
    bound = {no for event in events for no in event.change_nos}
    return EventOutput(
        True,
        model=model,
        generated_at=generated_at,
        dropped_event_count=dropped,
        events=rank(scaled, changes),
        unbound_change_nos=[c.change_no for c in candidates if c.change_no not in bound],
        calls=[*calls, *pick_calls],
    )
