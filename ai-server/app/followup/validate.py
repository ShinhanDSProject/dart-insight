"""약속과 실제 대조 검증(1.10, 5.5, ADR-0041).

코드가 계획마다 확인한다. 하나라도 어기면 전체를 다시 만든다(일부 계획만 내보내지 않음).
- 보낸 계획마다 정확히 하나씩 답했다(모르는 planId·겹침·빠짐 없음). status는 정한 값이다.
- MENTIONED·CHANGED: evidenceIds가 하나 이상이고 모두 **그 계획의 후보** 근거 ID다.
  quote가 인용한 후보 글의 부분 문자열이다(이어진 공백은 한 칸으로 맞춰 비교).
  summary의 숫자·크기 표현이 quote에 있다(app.llm.grounding).
  원인 표현(ADR-0015)은 quote에도 원인 표현이 있을 때만 쓴다.
  summary가 투자 권유성 표현 검사(app.compliance)와 평가 낱말 검사(JUDGMENT_WORDS)를 통과한다.
  걸리면 규칙 ID를 blocked_rules에 남긴다. quote는 회사가 쓴 원문이라 검사하지 않는다.
- NOT_FOUND: summary·quote가 비어 있고(null 또는 빈 글) evidenceIds가 빈 배열이다.
돌려주는 quote는 이어진 공백을 한 칸으로 맞춘 글이다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.compliance import scan
from app.followup.model import (
    FOLLOWUP_STATUSES,
    GENERATED,
    NOT_FOUND,
    Followup,
    FollowupInput,
    FollowupResult,
)
from app.llm.grounding import number_problem
from app.summary.causal import find as find_causal

MAX_SUMMARY = 160
MAX_QUOTE = 500
MIN_QUOTE = 10
JUDGMENT_RULE = "PLAN_JUDGMENT"
# 계획을 지켰는지 평가하는 낱말(ADR-0041). 서비스는 회사 문장을 나란히 놓을 뿐 평가하지 않는다
JUDGMENT_WORDS = re.compile(
    r"지켰|지키지\s*(?:않|못)|어겼|어기(?:고|었|지)|이행했|이행하였|이행하지\s*(?:않|못)"
    r"|이행\s*못|미이행|불이행|우수|실패|성공적"
)
_SPACES = re.compile(r"\s+")
_QUOTE_KEY = "quote"


@dataclass(frozen=True)
class Checked:
    """result는 통과했을 때만 있다. 아니면 problems(LLM에 알려 줄 문장)가 있다."""

    result: FollowupResult | None
    problems: list[str] = field(default_factory=list)
    blocked_rules: list[str] = field(default_factory=list)


def normalize(text: str) -> str:
    """비교용 글: 프롬프트에서 바꿔 넣은 &lt; 등을 되돌리고 이어진 공백을 한 칸으로."""
    plain = text.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    plain = plain.replace("&amp;", "&")
    return _SPACES.sub(" ", plain).strip()


def judgment_words(text: str) -> list[str]:
    """평가 낱말(지켰다·어겼다·이행했다·우수·실패·성공적 등)이 든 대목. 없으면 빈 목록"""
    return [m.group(0) for m in JUDGMENT_WORDS.finditer(text)]


def check(data: Any, followup: FollowupInput) -> Checked:
    if not isinstance(data, dict) or not isinstance(data.get("followups"), list):
        return Checked(None, ["followups 배열이 있는 JSON 객체가 필요합니다."])
    candidates = {
        p.plan_id: {c.evidence_id: normalize(c.text) for c in p.candidates} for p in followup.plans
    }
    answered: dict[str, Followup] = {}
    problems: list[str] = []
    blocked: set[str] = set()
    for no, entry in enumerate(data["followups"], start=1):
        plan_id = entry.get("planId") if isinstance(entry, dict) else None
        if plan_id not in candidates:
            problems.append(f"{no}번째 답: planId는 주어진 계획 id 중 하나여야 합니다({plan_id}).")
            continue
        if plan_id in answered:
            problems.append(f"{plan_id}: 계획마다 하나만 답하세요.")
            continue
        item, problem, rules = _followup(plan_id, entry, candidates[plan_id])
        if problem:
            problems.append(f"{plan_id}: {problem}")
            blocked.update(rules)
        elif item:
            answered[plan_id] = item
    missing = [p for p in candidates if p not in answered]
    if missing and not problems:
        problems.append(f"답하지 않은 계획이 있습니다: {missing[:5]}")
    if problems:
        return Checked(None, problems, sorted(blocked))
    return Checked(FollowupResult(GENERATED, [answered[p.plan_id] for p in followup.plans]))


def _followup(
    plan_id: str, entry: dict[str, Any], sources: dict[str, str]
) -> tuple[Followup | None, str | None, list[str]]:
    status = entry.get("status")
    summary = entry.get("summary")
    quote = entry.get("quote")
    evidence = entry.get("evidenceIds")
    if status not in FOLLOWUP_STATUSES:
        return None, f"status는 {', '.join(FOLLOWUP_STATUSES)} 중 하나여야 합니다.", []
    if not isinstance(evidence, list) or not all(isinstance(e, str) for e in evidence):
        return None, "evidenceIds는 문자열 배열이어야 합니다.", []
    if status == NOT_FOUND:
        if evidence or _filled(summary) or _filled(quote):
            return None, "NOT_FOUND는 summary·quote를 null로, evidenceIds를 []로 둡니다.", []
        return Followup(plan_id, NOT_FOUND, None, None, []), None, []
    if not sources:
        return None, "후보 문단이 없는 계획은 NOT_FOUND로만 답합니다.", []
    if not isinstance(summary, str) or not summary.strip():
        return None, "summary에 올해 문단의 요지가 있어야 합니다.", []
    summary = summary.strip()
    if len(summary) > MAX_SUMMARY:
        return None, f"summary가 {MAX_SUMMARY}자를 넘습니다.", []
    if not isinstance(quote, str) or len(normalize(quote)) < MIN_QUOTE:
        return None, f"quote에 올해 원문 글을 {MIN_QUOTE}자 이상 그대로 옮겨야 합니다.", []
    quote = normalize(quote)
    if len(quote) > MAX_QUOTE:
        return None, f"quote가 {MAX_QUOTE}자를 넘습니다. 한두 문장만 옮기세요.", []
    cited = list(dict.fromkeys(evidence))
    if not cited:
        return None, "근거가 없습니다. evidenceIds에 그 계획의 후보 id를 하나 이상 적으세요.", []
    unknown = [e for e in cited if e not in sources]
    if unknown:
        return None, f"그 계획의 후보 id가 아닙니다: {unknown[:3]}", []
    if not any(quote in sources[e] for e in cited):
        return None, "quote가 인용한 원문에 없습니다. 원문 글을 바꾸지 말고 그대로 옮기세요.", []
    problem = number_problem(summary, {_QUOTE_KEY: quote}, [_QUOTE_KEY])
    if problem:
        return None, problem.replace("인용한 원문", "quote"), []
    claim = find_causal(summary)
    if claim and not find_causal(quote):
        return None, f"원인 표현('{claim}')은 quote가 원인을 직접 밝혔을 때만 씁니다.", []
    findings = scan(summary)
    if findings:
        labels = ", ".join(dict.fromkeys(f.label for f in findings))
        quoted = ", ".join(f"'{f.matched}'" for f in findings[:3])
        return (
            None,
            f"투자 권유로 읽힐 수 있는 표현이 있습니다({labels}: {quoted}). "
            "회사가 적은 내용만 중립적으로 쓰세요.",
            [f.rule_id for f in findings],
        )
    judged = judgment_words(summary)
    if judged:
        quoted = ", ".join(f"'{w}'" for w in judged[:3])
        return (
            None,
            f"계획을 평가하는 표현이 있습니다({quoted}). 지켰는지·잘했는지 말하지 말고 "
            "올해 보고서가 적은 내용만 쓰세요.",
            [JUDGMENT_RULE],
        )
    return Followup(plan_id, status, summary, quote, cited), None, []


def _filled(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())
