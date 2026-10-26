"""근거로 답하기(3.10, ADR-0023). LLM은 app.llm.LlmClient로만 부른다.

- 투자 판단을 묻는 질문(app.compliance.scan_question)은 LLM을 부르지 않고 OUT_OF_SCOPE다.
- 후보 원문도 사실도 없으면 LLM을 부르지 않고 NOT_FOUND다.
- LLM이 답하면 검증(validate.check)하고, 실패하면 문제를 알려 주며 최대 2회 다시 생성한다.
  그래도 실패하면 답을 버리고 REVIEW_NEEDED다. 표현 검사에 걸렸으면 규칙 ID를 남긴다.
- LLM을 부를 수 없으면(LlmUnavailable) 그대로 던진다. 부른 쪽이 503으로 바꾼다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.answer import fake
from app.answer.model import NOT_FOUND, OUT_OF_SCOPE, REVIEW_NEEDED, AnswerInput, AnswerResult
from app.answer.prompt import PROMPT_VERSION, TASK, build_request
from app.answer.validate import check
from app.compliance import scan_question
from app.llm import CallRecord, LlmClient, LlmOutputInvalid, OutputProblem
from app.llm.providers import FAKE_RESPONDERS

logger = logging.getLogger("app.answer")
FAKE_RESPONDERS[TASK] = fake.respond

NOT_VERIFIED = "다시 생성해도 근거·숫자 확인을 통과하지 못했어요."


@dataclass(frozen=True)
class AnswerOutput:
    result: AnswerResult
    model: str | None
    prompt_version: str
    generated_at: str | None
    calls: list[CallRecord] = field(default_factory=list)


def answer(llm: LlmClient, question: AnswerInput) -> AnswerOutput:
    # blocked_rules는 답의 표현 검사(5.5) 결과만 담는다. 질문 거르기는 상태로만 알린다
    if scan_question(question.question):
        return AnswerOutput(AnswerResult(OUT_OF_SCOPE), None, PROMPT_VERSION, None)
    if not question.sources and not question.facts:
        return AnswerOutput(AnswerResult(NOT_FOUND), None, PROMPT_VERSION, None)

    def validate(data: object) -> AnswerResult:
        checked = check(data, question)
        if checked.result is None:
            raise OutputProblem(checked.problems)
        return checked.result

    try:
        generated = llm.generate(build_request(question), validate)
    except LlmOutputInvalid as e:
        logger.warning("답 검증 실패, 검토 필요로 끝냄: %s", e.problems[:3])
        blocked = check(e.last_output, question).blocked_rules
        reason = (
            "투자 권유로 읽힐 수 있는 표현이 있어 답을 내보내지 않았어요."
            if blocked
            else NOT_VERIFIED
        )
        result = AnswerResult(REVIEW_NEEDED, review_reason=reason, blocked_rules=blocked)
        model = e.calls[-1].model if e.calls else None
        generated_at = e.calls[-1].called_at if e.calls else None
        return AnswerOutput(result, model, PROMPT_VERSION, generated_at, e.calls)
    return AnswerOutput(
        generated.value, generated.model, PROMPT_VERSION, generated.generated_at, generated.calls
    )
