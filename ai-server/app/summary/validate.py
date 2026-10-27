"""요약 결과 검증(3.2, 5.5).

근거 ID가 주어진 원문 위치인지, 숫자가 인용한 원문에 있는지 코드가 확인한다.
재무 설명은 인용문을 확인해 등급을 낮추고(다시 생성하지 않음), STATED가 아닌 설명의
원인 표현은 다시 생성한다(ADR-0015). 등급 규칙을 바꾸면 causal.GRADE_RULES_VERSION을 올린다.
통과한 문장도 투자 권유성 표현 검사(app.compliance)에 걸리면 내보내지 않는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.compliance import scan
from app.llm.grounding import number_problem
from app.summary import causal
from app.summary.model import (
    FINANCIAL,
    GRADES,
    NONE,
    OK,
    RELATED,
    REVIEW_NEEDED,
    STATED,
    TEXT,
    FinancialItem,
    ItemResult,
    SummaryInput,
    TextItem,
)

MAX_SENTENCE = 200
MAX_EXPLANATION = 300
_SPACES = re.compile(r"\s")

# 코드가 등급을 낮춘 사유(reviewReason). 화면에서 후보가 없던 NONE과 구분해 보인다
QUOTE_NOT_CANDIDATE = "인용 위치가 설명 후보 원문이 아니어서 설명으로 쓰지 않았어요."
QUOTE_NOT_EVIDENCE = "인용 위치가 설명의 근거 원문이 아니어서 설명으로 쓰지 않았어요."
QUOTE_NOT_IN_SOURCE = "인용문이 후보 원문에 그대로 없어 설명으로 쓰지 않았어요."
QUOTE_WITHOUT_ACCOUNT = "인용문에 계정 이름이 없어 '관련 내용'으로 낮췄어요."


@dataclass(frozen=True)
class Checked:
    results: dict[str, ItemResult]
    problems: list[str]


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
            problem, result = _check_financial(financial_items[ref], raw, evidence)
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
    return number_problem(sentence, allowed, evidence)


def _check_financial(
    item: FinancialItem, raw: dict[str, Any], evidence: list[str]
) -> tuple[str | None, ItemResult]:
    """형식·근거·숫자를 확인하고 등급을 낮춘 뒤, 남은 등급에 맞지 않는 원인 표현을 찾는다.

    형식·근거·숫자·원인 표현 문제는 다시 생성하고, 인용 문제는 등급만 낮춘다.
    """
    grade = raw.get("grade")
    if grade not in GRADES:
        return "grade는 STATED·RELATED·NONE 중 하나여야 합니다.", _none(item)
    if grade == NONE:
        # 설명을 같이 썼어도 버린다(코드는 등급을 올리지 않음)
        return None, _none(item)
    explanation = raw.get("explanation")
    problem = _explanation_problem(item, explanation, evidence)
    if problem:
        return problem, _none(item)
    grade, reason = _downgrade(item, grade, raw.get("quote"), raw.get("quoteEvidenceId"), evidence)
    if grade == NONE:
        return None, _none(item, reason)
    claim = causal.find(explanation) if grade != STATED else None
    if claim:
        return (
            f"원인 표현('{claim}')은 회사가 원인을 직접 밝힌(STATED) 설명에만 씁니다. "
            "관련 내용(RELATED)이면 '관련 공시 내용으로 ~이 있어요'처럼 원인 없이 쓰세요.",
            _none(item),
        )
    return None, ItemResult(
        item.ref,
        FINANCIAL,
        OK,
        explanation=explanation,
        evidence_ids=evidence,
        review_reason=reason,
        grade=grade,
        quote=raw.get("quote"),
        quote_evidence_id=raw.get("quoteEvidenceId"),
    )


def _none(item: FinancialItem, reason: str | None = None) -> ItemResult:
    """확인된 설명 없음. reason이 있으면 코드가 등급을 낮춘 것"""
    return ItemResult(item.ref, FINANCIAL, OK, review_reason=reason, grade=NONE)


def _explanation_problem(item: FinancialItem, explanation: Any, evidence: list[str]) -> str | None:
    if not isinstance(explanation, str) or not explanation.strip():
        return "STATED·RELATED이면 explanation에 문장이 있어야 합니다(설명이 없으면 NONE)."
    if len(explanation) > MAX_EXPLANATION:
        return f"explanation이 {MAX_EXPLANATION}자를 넘습니다."
    allowed = {s.evidence_id: s.text for s in item.candidates}
    if not evidence:
        return "설명에 근거 id가 없습니다."
    unknown = [e for e in evidence if e not in allowed]
    if unknown:
        return f"후보 원문 id가 아닙니다: {unknown[:3]}"
    return number_problem(explanation, allowed, evidence)


def _downgrade(
    item: FinancialItem, grade: str, quote: Any, quote_evidence_id: Any, evidence: list[str]
) -> tuple[str, str | None]:
    """인용문을 글자로 확인해 등급을 낮춘다. (남은 등급, 낮췄으면 사유)"""
    sources = {s.evidence_id: s.text for s in item.candidates}
    if not isinstance(quote_evidence_id, str) or quote_evidence_id not in sources:
        return NONE, QUOTE_NOT_CANDIDATE
    # 설명이 근거로 든 문단이 아닌 곳을 인용하면 설명과 인용이 서로 다른 문단을 가리킨다
    if quote_evidence_id not in evidence:
        return NONE, QUOTE_NOT_EVIDENCE
    quoted = _SPACES.sub("", quote) if isinstance(quote, str) else ""
    if not quoted or quoted not in _SPACES.sub("", sources[quote_evidence_id]):
        return NONE, QUOTE_NOT_IN_SOURCE
    terms = [_SPACES.sub("", t) for t in item.account_aliases or [item.account_name]]
    if grade == STATED and not any(t and t in quoted for t in terms):
        return RELATED, QUOTE_WITHOUT_ACCOUNT
    return grade, None
