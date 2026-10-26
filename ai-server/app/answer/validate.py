"""질문 답변 검증(3.10, 5.5, ADR-0023).

코드가 확인한다.
- evidenceIds·factRefs가 보낸 후보·사실이고, ANSWERED면 둘 중 하나 이상 있다.
- 답 안의 근거 표시([원문 id]·[ref])가 evidenceIds·factRefs와 같다.
- 숫자·크기 표현이 인용한 원문·사실에 있다(app.llm.grounding).
- 원인 표현(ADR-0015)은 인용한 원문에도 원인 표현이 있을 때만 쓴다.
- 투자 권유성 표현 검사(app.compliance)를 통과한다. 걸리면 규칙 ID를 blocked_rules에 남긴다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.answer.model import ANSWERED, LLM_STATUSES, NOT_FOUND, AnswerInput, AnswerResult
from app.compliance import scan
from app.llm.grounding import number_problem
from app.summary.causal import find as find_causal

MAX_ANSWER = 400
_MARKER = re.compile(r"\[([^\[\]\n]+)\]")


@dataclass(frozen=True)
class Checked:
    """result는 통과했을 때만 있다. 아니면 problems(LLM에 알려 줄 문장)가 있다."""

    result: AnswerResult | None
    problems: list[str] = field(default_factory=list)
    blocked_rules: list[str] = field(default_factory=list)


def _strings(value: Any) -> list[str] | None:
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        return None
    return list(dict.fromkeys(value))


def check(data: Any, question: AnswerInput) -> Checked:
    if not isinstance(data, dict):
        return Checked(None, ["status·answer·evidenceIds·factRefs가 있는 JSON 객체가 필요합니다."])
    status = data.get("status")
    if status not in LLM_STATUSES:
        return Checked(None, ["status는 ANSWERED·NOT_FOUND 중 하나여야 합니다."])
    if status == NOT_FOUND:
        return Checked(AnswerResult(NOT_FOUND))
    evidence = _strings(data.get("evidenceIds"))
    refs = _strings(data.get("factRefs"))
    if evidence is None or refs is None:
        return Checked(None, ["evidenceIds·factRefs는 문자열 배열이어야 합니다."])
    answer = data.get("answer")
    problem = _answer_problem(answer, evidence, refs, question)
    if problem:
        return Checked(None, [problem])
    assert isinstance(answer, str)
    findings = scan(_without_markers(answer))
    if findings:
        labels = ", ".join(dict.fromkeys(f.label for f in findings))
        quoted = ", ".join(f"'{f.matched}'" for f in findings[:3])
        return Checked(
            None,
            [
                f"투자 권유로 읽힐 수 있는 표현이 있습니다({labels}: {quoted}). "
                "공시에 적힌 사실만 중립적으로 쓰세요."
            ],
            sorted({f.rule_id for f in findings}),
        )
    return Checked(AnswerResult(ANSWERED, answer.strip(), evidence, refs))


def _without_markers(answer: str) -> str:
    """근거 표시(접수번호의 숫자 포함)를 뺀 본문. 숫자·표현 검사는 본문으로 한다."""
    return _MARKER.sub("", answer)


def _answer_problem(
    answer: Any, evidence: list[str], refs: list[str], question: AnswerInput
) -> str | None:
    if not isinstance(answer, str) or not answer.strip():
        return "ANSWERED이면 answer에 문장이 있어야 합니다(답할 수 없으면 NOT_FOUND)."
    if len(answer) > MAX_ANSWER:
        return f"answer가 {MAX_ANSWER}자를 넘습니다."
    sources = {s.evidence_id: s.text for s in question.sources}
    facts = {f.ref: f.sentence for f in question.facts}
    unknown = [e for e in evidence if e not in sources] + [r for r in refs if r not in facts]
    if unknown:
        return f"주어진 원문 id·사실 ref가 아닙니다: {unknown[:3]}"
    if not evidence and not refs:
        return "근거가 없습니다. evidenceIds나 factRefs에 근거를 하나 이상 적으세요."
    markers = list(dict.fromkeys(_MARKER.findall(answer)))
    cited = [*evidence, *refs]
    not_listed = [m for m in markers if m not in cited]
    if not_listed:
        return f"답의 근거 표시가 evidenceIds·factRefs에 없습니다: {not_listed[:3]}"
    not_marked = [c for c in cited if c not in markers]
    if not_marked:
        return f"evidenceIds·factRefs의 근거를 답 문장 끝에 [id]로 표시하세요: {not_marked[:3]}"
    body = _without_markers(answer)
    problem = number_problem(body, {**sources, **facts}, cited)
    if problem:
        return problem
    claim = find_causal(body)
    if claim and not any(find_causal(sources[e]) for e in evidence):
        return (
            f"원인 표현('{claim}')은 인용한 원문이 원인을 직접 밝혔을 때만 씁니다. "
            "원문에 적힌 내용만 원인 없이 쓰세요."
        )
    return None
