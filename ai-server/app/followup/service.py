"""약속과 실제 대조 만들기(1.10, ADR-0041). LLM은 app.llm.LlmClient로만 부른다.

- LLM 결과를 검증(validate.check)하고, 실패하면 문제를 알려 주며 최대 2회 다시 생성한다.
  그래도 실패하면 답을 모두 버리고 REVIEW_NEEDED다. 표현·평가 낱말 검사에 걸렸으면 규칙 ID를 남긴다.
- LLM을 부를 수 없으면(LlmUnavailable) 그대로 던진다. 부른 쪽이 503으로 바꾼다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.followup import fake
from app.followup.model import REVIEW_NEEDED, FollowupInput, FollowupResult
from app.followup.prompt import PROMPT_VERSION, TASK, build_request
from app.followup.validate import JUDGMENT_RULE, check
from app.llm import CallRecord, LlmClient, LlmOutputInvalid, OutputProblem
from app.llm.providers import FAKE_RESPONDERS

logger = logging.getLogger("app.followup")
FAKE_RESPONDERS[TASK] = fake.respond

NOT_VERIFIED = "다시 생성해도 인용·근거·숫자 확인을 통과하지 못했어요."
BLOCKED = "투자 권유로 읽힐 수 있는 표현이 있어 대조 결과를 내보내지 않았어요."
JUDGED = "계획을 평가하는 표현이 있어 대조 결과를 내보내지 않았어요."


@dataclass(frozen=True)
class FollowupOutput:
    result: FollowupResult
    model: str | None
    prompt_version: str
    generated_at: str | None
    calls: list[CallRecord] = field(default_factory=list)


def compare(llm: LlmClient, followup: FollowupInput) -> FollowupOutput:
    def validate(data: object) -> FollowupResult:
        checked = check(data, followup)
        if checked.result is None:
            raise OutputProblem(checked.problems)
        return checked.result

    try:
        generated = llm.generate(build_request(followup), validate)
    except LlmOutputInvalid as e:
        logger.warning("약속과 실제 대조 검증 실패, 검토 필요로 끝냄: %s", e.problems[:3])
        blocked = check(e.last_output, followup).blocked_rules
        result = FollowupResult(
            REVIEW_NEEDED, review_reason=_reason(blocked), blocked_rules=blocked
        )
        model = e.calls[-1].model if e.calls else None
        generated_at = e.calls[-1].called_at if e.calls else None
        return FollowupOutput(result, model, PROMPT_VERSION, generated_at, e.calls)
    return FollowupOutput(
        generated.value, generated.model, PROMPT_VERSION, generated.generated_at, generated.calls
    )


def _reason(blocked: list[str]) -> str:
    if not blocked:
        return NOT_VERIFIED
    return JUDGED if blocked == [JUDGMENT_RULE] else BLOCKED
