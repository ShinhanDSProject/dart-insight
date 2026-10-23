"""요약 가짜 응답(개발·테스트용). 실제 LLM 없이 입력만으로 규칙에 맞는 결과를 만든다.

결과에는 모델 이름 `fake-model`이 남아 실제 요약과 구분된다.
"""

from __future__ import annotations

import re
from typing import Any

from app.llm.providers import LlmRequest
from app.summary.model import RELATED, STATED, FinancialItem, Source, SummaryInput

_WORDS = {
    "ADDED": "새 내용이 들어갔어요",
    "DELETED": "내용이 문서에서 빠졌어요",
    "MODIFIED": "내용이 바뀌었어요",
}
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


def respond(request: LlmRequest) -> dict[str, Any]:
    summary = request.context
    if not isinstance(summary, SummaryInput):
        return {"items": []}
    items: list[dict[str, Any]] = []
    for item in summary.text_items:
        title = item.section_path.split(" > ")[-1]
        sentence = f"'{_no_digits(title)}' 항목에 {_WORDS.get(item.change_type, '변화가 있어요')}."
        items.append(
            {
                "ref": item.ref,
                "sentence": sentence,
                "explanation": None,
                "evidenceIds": [s.evidence_id for s in item.sources],
            }
        )
    for item in summary.financial_items:
        if item.candidates:
            items.append(_financial(item))
    return {"items": items}


def _financial(item: FinancialItem) -> dict[str, Any]:
    """계정 이름이 든 문장이 있으면 STATED, 없으면 첫 문장을 RELATED로 인용한다."""
    terms = [t.replace(" ", "") for t in item.account_aliases or [item.account_name]]
    found = next(
        (
            (source, sentence)
            for source in item.candidates
            for sentence in _sentences(source)
            if any(t and t in sentence.replace(" ", "") for t in terms)
        ),
        None,
    )
    if found:
        (source, quote), grade = found, STATED
        explanation = f"회사는 '{_where(source)}'에서 이 계정의 변화를 설명했어요."
    else:
        source = item.candidates[0]
        quote, grade = _sentences(source)[0], RELATED
        explanation = f"관련 공시 내용으로 '{_where(source)}'의 설명이 있어요."
    return {
        "ref": item.ref,
        "sentence": None,
        "explanation": explanation,
        "grade": grade,
        "quote": quote,
        "quoteEvidenceId": source.evidence_id,
        "evidenceIds": [source.evidence_id],
    }


def _sentences(source: Source) -> list[str]:
    return [s for s in _SENTENCE_END.split(source.text.strip()) if s] or [source.text]


def _where(source: Source) -> str:
    return _no_digits(source.section_path.split(" > ")[-1])


def _no_digits(text: str) -> str:
    """가짜 문장에 숫자가 섞여 숫자 검증에 걸리지 않게 항목 번호를 뺀다."""
    return "".join(ch for ch in text if not ch.isdigit()).strip(" .")
