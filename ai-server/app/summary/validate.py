"""요약 결과 검증(3.2).

근거 ID가 주어진 원문 위치인지, 숫자가 인용한 원문에 있는지 코드가 확인한다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

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
        results[ref] = result
    for ref in [*text_items, *financial_items]:
        if ref not in results:
            problems.append(f"{ref}: 결과가 없습니다.")
    return Checked(results, problems)


def _cited_numbers(sources: dict[str, str], evidence: list[str], extra: str = "") -> set[str]:
    return numbers(" ".join(sources[e] for e in evidence if e in sources) + " " + extra)


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
    extra = numbers(sentence) - _cited_numbers(allowed, evidence, item.section_path)
    if extra:
        return f"인용한 원문에 없는 숫자가 있습니다: {sorted(extra)[:3]}"
    return None


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
    extra = numbers(explanation) - _cited_numbers(allowed, evidence)
    if extra:
        return f"인용한 원문에 없는 숫자가 있습니다: {sorted(extra)[:3]}"
    return None
