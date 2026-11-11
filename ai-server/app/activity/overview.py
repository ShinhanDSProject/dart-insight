"""두 보고서 사이 한 문단 요약과 타임라인 만들기(ADR-0068). LLM은 app.llm.LlmClient로만 부른다.

카드와 따로 한 번 더 부른다. 입력은 코드가 계산한 재무 수치, 사이 기간 공시, 보고서 문단이다.
검증(validate.check_overview)에 실패하면 최대 2회 다시 만들고, 그래도 어긋난 요약·줄만 뺀다.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from app.activity.model import (
    Activity,
    ActivityInput,
    OverviewContext,
    OverviewResult,
    Source,
)
from app.activity.prompt import build_overview_request
from app.activity.validate import check_overview
from app.llm import CallRecord, LlmClient, LlmOutputInvalid, OutputProblem

logger = logging.getLogger("app.activity")

_DATE_IN_TEXT = re.compile(r"(?<!\d)(?:20)?\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}(?!\d)")


def report_sources(activity: ActivityInput, items: list[Activity]) -> list[Source]:
    """요약·타임라인에 넣을 보고서 문단: 카드가 인용한 문단과 날짜 표현이 있는 문단."""
    cited = {q.evidence_id for a in items for q in a.facts}
    cited |= {p.evidence_id for a in items for i in a.impacts for p in i.premises}
    return [s for s in activity.sources if s.evidence_id in cited or _DATE_IN_TEXT.search(s.text)]


@dataclass(frozen=True)
class OverviewOutput:
    result: OverviewResult
    calls: list[CallRecord] = field(default_factory=list)


def generate(llm: LlmClient, activity: ActivityInput, items: list[Activity]) -> OverviewOutput:
    """요약과 타임라인. LLM을 부를 수 없으면(LlmUnavailable) 그대로 던진다."""
    context = OverviewContext(activity, report_sources(activity, items))

    def validate(data: object) -> OverviewResult:
        checked = check_overview(data, context)
        if checked.problems:
            raise OutputProblem(checked.problems)
        return checked.result

    try:
        generated = llm.generate(build_overview_request(context), validate)
    except LlmOutputInvalid as e:
        checked = check_overview(e.last_output, context)
        logger.warning("요약·타임라인 검증 실패, 통과한 부분만 씀: %s", e.problems[:3])
        return OverviewOutput(checked.result, e.calls)
    return OverviewOutput(generated.value, generated.calls)
