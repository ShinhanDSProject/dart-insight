"""요약 가짜 응답(개발·테스트용). 실제 LLM 없이 입력만으로 규칙에 맞는 결과를 만든다.

결과에는 모델 이름 `fake-model`이 남아 실제 요약과 구분된다.
"""

from __future__ import annotations

from typing import Any

from app.llm.providers import LlmRequest
from app.summary.model import SummaryInput

_WORDS = {
    "ADDED": "새 내용이 들어갔어요",
    "DELETED": "내용이 문서에서 빠졌어요",
    "MODIFIED": "내용이 바뀌었어요",
}


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
        if not item.candidates:
            continue
        source = item.candidates[0]
        where = _no_digits(source.section_path.split(" > ")[-1])
        explanation = f"회사는 '{where}'에서 이 계정의 변화를 설명했어요."
        items.append(
            {
                "ref": item.ref,
                "sentence": None,
                "explanation": explanation,
                "evidenceIds": [source.evidence_id],
            }
        )
    return {"items": items}


def _no_digits(text: str) -> str:
    """가짜 문장에 숫자가 섞여 숫자 검증에 걸리지 않게 항목 번호를 뺀다."""
    return "".join(ch for ch in text if not ch.isdigit()).strip(" .")
