"""두 보고서 사이 활동과 앞으로의 영향 만들기(ADR-0067). LLM은 app.llm.LlmClient로만 부른다.

- 원문이 없으면 LLM을 부르지 않고 EMPTY다.
- 결과를 검증(validate.check)하고, 실패하면 문제를 알려 주며 최대 2회 다시 만든다.
  그래도 어긋난 카드는 빼고 뺀 수를 남긴다. 쓸 수 있는 카드가 없으면 REVIEW_NEEDED다.
  요약(overview)이 어긋났으면 요약만 비운다. 실패를 성공으로 내보내지 않는다.
- LLM을 부를 수 없으면(LlmUnavailable) 그대로 던진다(부른 쪽이 503으로 바꿈).
- 신호는 코드가 기준표로 붙인다(validate._signal).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.activity import fake
from app.activity.model import EMPTY, GENERATED, REVIEW_NEEDED, ActivityInput, ActivityResult
from app.activity.prompt import PROMPT_VERSION, TASK, build_request
from app.activity.validate import check
from app.llm import CallRecord, LlmClient, LlmOutputInvalid, OutputProblem
from app.llm.providers import FAKE_RESPONDERS

logger = logging.getLogger("app.activity")
FAKE_RESPONDERS[TASK] = fake.respond

NOT_VERIFIED = "다시 생성해도 인용·근거·숫자·표현 확인을 통과한 활동이 없어요."
BLOCKED = "투자 권유로 읽힐 수 있는 표현이 있어 활동·영향을 내보내지 않았어요."


@dataclass(frozen=True)
class ActivityOutput:
    result: ActivityResult
    model: str | None
    prompt_version: str
    generated_at: str | None
    calls: list[CallRecord] = field(default_factory=list)
    candidate_count: int = 0


def summarize(llm: LlmClient, activity: ActivityInput) -> ActivityOutput:
    if not activity.sources:
        return ActivityOutput(
            ActivityResult(EMPTY),
            None,
            PROMPT_VERSION,
            None,
            candidate_count=activity.candidate_count,
        )

    def validate(data: object) -> ActivityResult:
        checked = check(data, activity)
        if checked.result is None:
            raise OutputProblem(checked.problems)
        return checked.result

    try:
        generated = llm.generate(build_request(activity), validate)
    except LlmOutputInvalid as e:
        checked = check(e.last_output, activity)
        model = e.calls[-1].model if e.calls else None
        generated_at = e.calls[-1].called_at if e.calls else None
        if not checked.valid_items:
            logger.warning("활동·영향 검증 실패, 검토 필요로 끝냄: %s", e.problems[:3])
            reason = BLOCKED if checked.blocked_rules else NOT_VERIFIED
            result = ActivityResult(
                REVIEW_NEEDED, review_reason=reason, blocked_rules=checked.blocked_rules
            )
            return ActivityOutput(
                result, model, PROMPT_VERSION, generated_at, e.calls, activity.candidate_count
            )
        dropped = len(e.last_output.get("items", [])) - len(checked.valid_items)
        logger.warning("검증에 실패한 활동 %d건을 뺌 prompt=%s", dropped, PROMPT_VERSION)
        result = ActivityResult(
            GENERATED,
            checked.overview,
            checked.valid_items,
            dropped_count=max(dropped, 0),
            blocked_rules=checked.blocked_rules,
        )
        return ActivityOutput(
            result, model, PROMPT_VERSION, generated_at, e.calls, activity.candidate_count
        )
    return ActivityOutput(
        generated.value,
        generated.model,
        PROMPT_VERSION,
        generated.generated_at,
        generated.calls,
        activity.candidate_count,
    )
