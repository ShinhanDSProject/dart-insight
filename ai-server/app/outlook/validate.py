"""회사가 밝힌 전망·계획 검증(1.9, 5.5, ADR-0039).

코드가 항목마다 확인한다. 하나라도 어기면 전체를 다시 만든다(일부 항목만 내보내지 않음).
- 항목이 0~10개이고, category가 정한 값이다. 0개는 실패가 아니라 EMPTY다.
- evidenceIds가 하나 이상이고 모두 보낸 근거 ID다.
- quote가 인용한 원문 중 하나의 부분 문자열이다(이어진 공백은 한 칸으로 맞춰 비교).
- summary의 숫자·크기 표현이 quote에 있다(app.llm.grounding).
- 원인 표현(ADR-0015)은 quote에도 원인 표현이 있을 때만 쓴다.
- summary가 투자 권유성 표현 검사(app.compliance)를 통과한다.
  걸리면 규칙 ID를 blocked_rules에 남긴다.
  quote는 회사가 쓴 원문이라 검사하지 않는다.
돌려주는 quote는 이어진 공백을 한 칸으로 맞춘 글이다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.compliance import scan
from app.llm.grounding import number_problem
from app.outlook.model import CATEGORIES, EMPTY, GENERATED, Item, OutlookInput, OutlookResult
from app.outlook.prompt import MAX_ITEMS
from app.summary.causal import find as find_causal

# 프롬프트는 요지 100자·인용 300자를 요구하고, 검증은 조금 넉넉히 본다
MAX_SUMMARY = 160
MAX_QUOTE = 500
MIN_QUOTE = 10
_SPACES = re.compile(r"\s+")
_QUOTE_KEY = "quote"


@dataclass(frozen=True)
class Checked:
    """result는 통과했을 때만 있다. 아니면 problems(LLM에 알려 줄 문장)가 있다."""

    result: OutlookResult | None
    problems: list[str] = field(default_factory=list)
    blocked_rules: list[str] = field(default_factory=list)


def normalize(text: str) -> str:
    """비교용 글: 프롬프트에서 바꿔 넣은 &lt; 등을 되돌리고 이어진 공백을 한 칸으로."""
    plain = text.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    plain = plain.replace("&amp;", "&")
    return _SPACES.sub(" ", plain).strip()


def check(data: Any, outlook: OutlookInput) -> Checked:
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        return Checked(None, ["items 배열이 있는 JSON 객체가 필요합니다."])
    raw = data["items"]
    if len(raw) > MAX_ITEMS:
        return Checked(None, [f"items는 {MAX_ITEMS}개 이내여야 합니다(지금 {len(raw)}개)."])
    sources = {s.evidence_id: normalize(s.text) for s in outlook.sources}
    items: list[Item] = []
    problems: list[str] = []
    blocked: set[str] = set()
    for no, entry in enumerate(raw, start=1):
        item, problem, rules = _item(entry, sources)
        if problem:
            problems.append(f"{no}번 항목: {problem}")
            blocked.update(rules)
        elif item:
            items.append(item)
    if problems:
        return Checked(None, problems, sorted(blocked))
    return Checked(OutlookResult(GENERATED if items else EMPTY, items))


def _item(entry: Any, sources: dict[str, str]) -> tuple[Item | None, str | None, list[str]]:
    if not isinstance(entry, dict):
        return None, "category·summary·quote·evidenceIds가 있는 객체여야 합니다.", []
    category = entry.get("category")
    summary = entry.get("summary")
    quote = entry.get("quote")
    evidence = entry.get("evidenceIds")
    if category not in CATEGORIES:
        return None, f"category는 {', '.join(CATEGORIES)} 중 하나여야 합니다.", []
    if not isinstance(summary, str) or not summary.strip():
        return None, "summary에 요지가 있어야 합니다.", []
    summary = summary.strip()
    if len(summary) > MAX_SUMMARY:
        return None, f"summary가 {MAX_SUMMARY}자를 넘습니다.", []
    if not isinstance(quote, str) or len(normalize(quote)) < MIN_QUOTE:
        return None, f"quote에 원문 글을 {MIN_QUOTE}자 이상 그대로 옮겨야 합니다.", []
    quote = normalize(quote)
    if len(quote) > MAX_QUOTE:
        return None, f"quote가 {MAX_QUOTE}자를 넘습니다. 한두 문장만 옮기세요.", []
    if not isinstance(evidence, list) or not all(isinstance(e, str) for e in evidence):
        return None, "evidenceIds는 문자열 배열이어야 합니다.", []
    cited = list(dict.fromkeys(evidence))
    if not cited:
        return None, "근거가 없습니다. evidenceIds에 원문 id를 하나 이상 적으세요.", []
    unknown = [e for e in cited if e not in sources]
    if unknown:
        return None, f"주어진 원문 id가 아닙니다: {unknown[:3]}", []
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
            "회사가 밝힌 내용만 중립적으로 쓰세요.",
            [f.rule_id for f in findings],
        )
    return Item(category, summary, quote, cited), None, []
