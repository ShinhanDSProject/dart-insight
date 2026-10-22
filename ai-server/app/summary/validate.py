"""요약 결과 검증(3.2, 5.5).

근거 ID가 주어진 원문 위치인지, 숫자가 인용한 원문에 있는지 코드가 확인한다.
통과한 문장도 투자 권유성 표현 검사(app.compliance)에 걸리면 내보내지 않는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.compliance import scan
from app.summary.model import (
    FINANCIAL,
    OK,
    REVIEW_NEEDED,
    TEXT,
    FinancialItem,
    ItemResult,
    SummaryInput,
    TextItem,
)

MAX_SENTENCE = 200
MAX_EXPLANATION = 300
_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
# 숫자 없이 크기를 말하는 표현(두 배, 절반)과 단위가 붙은 수(1조, 500억).
# 원문에 같은 표현이 있어야 쓸 수 있다
_MAGNITUDE = re.compile(
    r"(?:\d+(?:\.\d+)?|[한두세네다섯여섯일곱여덟아홉열몇수]+)\s*배"
    r"(?=로|가|나|만큼|이상|이하|\s|$|[.,!?)])"
    r"|절반|\d+\s*분의\s*\d+"
    r"|\d[\d,]*(?:\.\d+)?\s*(?:조|억|만|천)"
)
_SQUEEZE = re.compile(r"[\s,]")


@dataclass
class Checked:
    results: dict[str, ItemResult]
    problems: list[str]


def numbers(text: str) -> set[str]:
    return {n.replace(",", "").rstrip(".") for n in _NUMBER.findall(text)}


def _strings(value: Any) -> list[str] | None:
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        return None
    return value


def check(data: Any, summary: SummaryInput) -> Checked:
    """항목별로 확인한다. 통과한 항목은 OK, 아닌 항목은 사유와 함께 problems에 남긴다."""
    text_items = {i.ref: i for i in summary.text_items}
    financial_items = {i.ref: i for i in summary.financial_items if i.candidates}
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        return Checked({}, ["items 배열이 있는 JSON 객체가 필요합니다."])
    results: dict[str, ItemResult] = {}
    problems: list[str] = []
    for raw in data["items"]:
        if not isinstance(raw, dict) or not isinstance(raw.get("ref"), str):
            problems.append("각 항목에 ref 문자열이 필요합니다.")
            continue
        ref = raw["ref"]
        if ref in results:
            problems.append(f"{ref}: 같은 ref를 두 번 썼습니다.")
            continue
        evidence = _strings(raw.get("evidenceIds"))
        if evidence is None:
            problems.append(f"{ref}: evidenceIds는 문자열 배열이어야 합니다.")
            continue
        if ref in text_items:
            problem = _check_text(text_items[ref], raw.get("sentence"), evidence)
            result = ItemResult(ref, TEXT, OK, sentence=raw.get("sentence"), evidence_ids=evidence)
        elif ref in financial_items:
            problem = _check_financial(financial_items[ref], raw.get("explanation"), evidence)
            explanation = raw.get("explanation")
            result = ItemResult(
                ref,
                FINANCIAL,
                OK,
                explanation=explanation,
                evidence_ids=evidence if explanation else [],
            )
        else:
            problems.append(f"{ref}: 요청에 없는 ref입니다.")
            continue
        if problem:
            problems.append(f"{ref}: {problem}")
            result = ItemResult(ref, result.kind, REVIEW_NEEDED, review_reason=problem)
        else:
            result = _check_expressions(result, problems)
        results[ref] = result
    for ref in [*text_items, *financial_items]:
        if ref not in results:
            problems.append(f"{ref}: 결과가 없습니다.")
    return Checked(results, problems)


def _number_problem(text: str, sources: dict[str, str], evidence: list[str]) -> str | None:
    """숫자와 크기 표현이 인용한 원문에 그대로 있는지. LLM이 계산하거나 바꿔 쓴 숫자를 막는다."""
    cited = " ".join(sources[e] for e in evidence if e in sources)
    extra = numbers(text) - numbers(cited)
    if extra:
        return f"인용한 원문에 없는 숫자가 있습니다: {sorted(extra)[:3]}"
    squeezed = _SQUEEZE.sub("", cited)
    missing = [
        m.group(0)
        for m in _MAGNITUDE.finditer(text)
        if _SQUEEZE.sub("", m.group(0)) not in squeezed
    ]
    if missing:
        return f"인용한 원문에 없는 크기 표현이 있습니다: {missing[:3]}. 원문 표현을 그대로 쓰세요."
    return None


def _check_expressions(result: ItemResult, problems: list[str]) -> ItemResult:
    """AI 문장에 투자 권유성 표현이 있으면 내보내지 않고 걸린 규칙과 함께 '검토 필요'로 바꾼다."""
    findings = scan(result.sentence) + scan(result.explanation)
    if not findings:
        return result
    rules = sorted({f.rule_id for f in findings})
    labels = ", ".join(dict.fromkeys(f.label for f in findings))
    quoted = ", ".join(f"'{f.matched}'" for f in findings[:3])
    problems.append(
        f"{result.ref}: 투자 권유로 읽힐 수 있는 표현이 있습니다({labels}: {quoted}). "
        "공시에 적힌 사실만 중립적으로 쓰세요."
    )
    return ItemResult(
        result.ref,
        result.kind,
        REVIEW_NEEDED,
        review_reason=f"투자 권유로 읽힐 수 있는 표현({labels})이 있어 내보내지 않았어요.",
        blocked_rules=rules,
    )


def _check_text(item: TextItem, sentence: Any, evidence: list[str]) -> str | None:
    if not isinstance(sentence, str) or not sentence.strip():
        return "sentence가 비어 있습니다."
    if len(sentence) > MAX_SENTENCE:
        return f"sentence가 {MAX_SENTENCE}자를 넘습니다."
    allowed = {s.evidence_id: s.text for s in item.sources}
    if not evidence:
        return "근거 id가 없습니다."
    unknown = [e for e in evidence if e not in allowed]
    if unknown:
        return f"주어진 원문 id가 아닙니다: {unknown[:3]}"
    return _number_problem(sentence, allowed, evidence)


def _check_financial(item: FinancialItem, explanation: Any, evidence: list[str]) -> str | None:
    if explanation is None:
        return None  # 후보 원문이 그 변화를 설명하지 않음 → '확인된 설명 없음'
    if not isinstance(explanation, str) or not explanation.strip():
        return "explanation은 문장이거나 null이어야 합니다."
    if len(explanation) > MAX_EXPLANATION:
        return f"explanation이 {MAX_EXPLANATION}자를 넘습니다."
    allowed = {s.evidence_id: s.text for s in item.candidates}
    if not evidence:
        return "설명에 근거 id가 없습니다."
    unknown = [e for e in evidence if e not in allowed]
    if unknown:
        return f"후보 원문 id가 아닙니다: {unknown[:3]}"
    return _number_problem(explanation, allowed, evidence)
