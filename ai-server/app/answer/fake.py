"""질문 답변 가짜 응답(개발·테스트용). 실제 LLM 없이 입력만으로 검증을 통과하는 답을 만든다.

결과에는 모델 이름 `fake-model`이 남아 실제 답과 구분된다.
"""

from __future__ import annotations

import re
from typing import Any

from app.answer.model import ANSWERED, NOT_FOUND, AnswerInput
from app.llm.providers import LlmRequest

SNIPPET_CHARS = 60
_SPACES = re.compile(r"\s+")


def respond(request: LlmRequest) -> dict[str, Any]:
    question = request.context
    if not isinstance(question, AnswerInput):
        return _not_found()
    if question.sources:
        source = question.sources[0]
        answer = f"관련 공시 내용으로 '{_snippet(source.text)}'이 있어요[{source.evidence_id}]."
        return {
            "status": ANSWERED,
            "answer": answer,
            "evidenceIds": [source.evidence_id],
            "factRefs": [],
        }
    if question.facts:
        fact = question.facts[0]
        answer = f"{fact.sentence.strip().rstrip('.')}[{fact.ref}]."
        return {"status": ANSWERED, "answer": answer, "evidenceIds": [], "factRefs": [fact.ref]}
    return _not_found()


def _not_found() -> dict[str, Any]:
    return {"status": NOT_FOUND, "answer": None, "evidenceIds": [], "factRefs": []}


def _snippet(text: str) -> str:
    """원문 앞부분을 낱말 단위로 자른다. 숫자가 중간에서 잘려 숫자 검증에 걸리지 않게 한다."""
    flat = _SPACES.sub(" ", text.replace("[", "(").replace("]", ")")).strip()
    if len(flat) <= SNIPPET_CHARS:
        return flat
    cut = flat[:SNIPPET_CHARS]
    if flat[SNIPPET_CHARS] != " " and " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip() + "…"
