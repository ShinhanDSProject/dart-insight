"""AI 기업 브리핑 검증(1.2, 5.5, ADR-0025).

코드가 문장마다 확인한다. 하나라도 어기면 브리핑 전체를 다시 만든다(일부 문장만 내보내지 않음).
- 문장이 1~6개이고, 문장마다 글이 있고 160자를 넘지 않는다.
- evidenceIds가 하나 이상이고 모두 보낸 근거 ID다.
- 숫자·크기 표현이 그 문장이 인용한 원문에 있다(app.llm.grounding).
- 원인 표현(ADR-0015)은 인용한 원문에도 원인 표현이 있을 때만 쓴다.
- 투자 권유성 표현 검사(app.compliance)를 통과한다. 걸리면 규칙 ID를 blocked_rules에 남긴다.
문장 안의 `[근거 ID]` 표시는 지우고 돌려준다(근거는 evidenceIds로만 전한다).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.briefing.model import GENERATED, BriefingInput, BriefingResult, Sentence
from app.briefing.prompt import MAX_SENTENCES
from app.compliance import scan
from app.llm.grounding import number_problem
from app.summary.causal import find as find_causal

# 프롬프트는 120자를 요구하고, 검증은 조금 넉넉히 본다
MAX_TEXT = 160
_MARKER = re.compile(r"\s*\[[^\[\]\n]*#B\d+[^\[\]\n]*\]")


@dataclass(frozen=True)
class Checked:
    """result는 통과했을 때만 있다. 아니면 problems(LLM에 알려 줄 문장)가 있다."""

    result: BriefingResult | None
    problems: list[str] = field(default_factory=list)
    blocked_rules: list[str] = field(default_factory=list)


def check(data: Any, briefing: BriefingInput) -> Checked:
    if not isinstance(data, dict) or not isinstance(data.get("sentences"), list):
        return Checked(None, ["sentences 배열이 있는 JSON 객체가 필요합니다."])
    items = data["sentences"]
    if not 1 <= len(items) <= MAX_SENTENCES:
        return Checked(None, [f"sentences는 1~{MAX_SENTENCES}개여야 합니다(지금 {len(items)}개)."])
    sources = {s.evidence_id: s.text for s in briefing.sources}
    sentences: list[Sentence] = []
    problems: list[str] = []
    blocked: set[str] = set()
    for no, item in enumerate(items, start=1):
        sentence, problem, rules = _sentence(item, sources)
        if problem:
            problems.append(f"{no}번 문장: {problem}")
            blocked.update(rules)
        elif sentence:
            sentences.append(sentence)
    if problems:
        return Checked(None, problems, sorted(blocked))
    return Checked(BriefingResult(GENERATED, sentences))


def _sentence(
    item: Any, sources: dict[str, str]
) -> tuple[Sentence | None, str | None, list[str]]:
    if not isinstance(item, dict):
        return None, "text·evidenceIds가 있는 객체여야 합니다.", []
    text = item.get("text")
    evidence = item.get("evidenceIds")
    if not isinstance(text, str) or not text.strip():
        return None, "text에 문장이 있어야 합니다.", []
    body = _MARKER.sub("", text).strip()
    if len(body) > MAX_TEXT:
        return None, f"문장이 {MAX_TEXT}자를 넘습니다.", []
    if not isinstance(evidence, list) or not all(isinstance(e, str) for e in evidence):
        return None, "evidenceIds는 문자열 배열이어야 합니다.", []
    cited = list(dict.fromkeys(evidence))
    if not cited:
        return None, "근거가 없습니다. evidenceIds에 원문 id를 하나 이상 적으세요.", []
    unknown = [e for e in cited if e not in sources]
    if unknown:
        return None, f"주어진 원문 id가 아닙니다: {unknown[:3]}", []
    problem = number_problem(body, sources, cited)
    if problem:
        return None, problem, []
    claim = find_causal(body)
    if claim and not any(find_causal(sources[e]) for e in cited):
        return (
            None,
            f"원인 표현('{claim}')은 인용한 원문이 원인을 직접 밝혔을 때만 씁니다.",
            [],
        )
    findings = scan(body)
    if findings:
        labels = ", ".join(dict.fromkeys(f.label for f in findings))
        quoted = ", ".join(f"'{f.matched}'" for f in findings[:3])
        return (
            None,
            f"투자 권유로 읽힐 수 있는 표현이 있습니다({labels}: {quoted}). "
            "공시에 적힌 사실만 중립적으로 쓰세요.",
            [f.rule_id for f in findings],
        )
    return Sentence(body, cited), None, []
