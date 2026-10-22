"""근거 기반 요약(3.2). LLM은 app.llm.LlmClient로만 부른다.

- 문장 변화 항목: LLM이 무엇이 바뀌었는지 한 문장으로 쓴다. 근거는 그 변화의 원문 위치만 쓸 수 있다.
- 재무 수치 항목: 설명 후보 원문이 있을 때만 LLM이 회사의 설명을 한 문장으로 요약한다.
  후보가 없거나 LLM이 설명이 없다고 하면 explanation이 null이다('확인된 설명 없음').
- 검증(validate.check)에 실패하면 최대 2회 다시 생성하고, 그래도 실패한 항목만 '검토 필요'로 끝낸다.
- LLM을 부를 수 없으면(LlmUnavailable) 그대로 던진다. 부른 쪽이 분석을 실패로 끝낸다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime

from app.llm import CallRecord, LlmClient, LlmOutputInvalid, OutputProblem
from app.llm.client import KST
from app.llm.providers import FAKE_RESPONDERS
from app.summary import fake
from app.summary.model import FINANCIAL, OK, REVIEW_NEEDED, TEXT, ItemResult, SummaryInput
from app.summary.prompt import PROMPT_VERSION, TASK, build_request
from app.summary.validate import check

logger = logging.getLogger("app.summary")
FAKE_RESPONDERS[TASK] = fake.respond


@dataclass
class SummaryOutput:
    items: list[ItemResult]
    model: str | None
    prompt_version: str
    generated_at: str
    calls: list[CallRecord] = field(default_factory=list)


def summarize(llm: LlmClient, summary: SummaryInput) -> SummaryOutput:
    needs_llm = bool(summary.text_items) or any(i.candidates for i in summary.financial_items)
    no_explanation = [
        ItemResult(i.ref, FINANCIAL, OK) for i in summary.financial_items if not i.candidates
    ]
    now = datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S")
    if not needs_llm:
        return SummaryOutput(no_explanation, None, PROMPT_VERSION, now)

    def validate(data: object) -> dict[str, ItemResult]:
        checked = check(data, summary)
        if checked.problems:
            raise OutputProblem(checked.problems)
        return checked.results

    try:
        result = llm.generate(build_request(summary), validate)
        items, model, generated_at, calls = (
            result.value,
            result.model,
            result.generated_at,
            result.calls,
        )
    except LlmOutputInvalid as e:
        logger.warning("요약 검증 실패, 통과한 항목만 씀: %s", e.problems[:5])
        checked = check(e.last_output, summary)
        items = checked.results
        model = e.calls[-1].model if e.calls else None
        generated_at = e.calls[-1].called_at if e.calls else now
        calls = e.calls
        reason = "다시 생성해도 근거·숫자 확인을 통과하지 못했어요."
        for ref, kind in [(i.ref, TEXT) for i in summary.text_items] + [
            (i.ref, FINANCIAL) for i in summary.financial_items if i.candidates
        ]:
            if ref not in items:
                items[ref] = ItemResult(ref, kind, REVIEW_NEEDED, review_reason=reason)
    ordered = [items[i.ref] for i in summary.text_items if i.ref in items]
    ordered += [items[i.ref] for i in summary.financial_items if i.ref in items]
    return SummaryOutput(ordered + no_explanation, model, PROMPT_VERSION, generated_at, calls)
