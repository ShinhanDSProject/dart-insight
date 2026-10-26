"""AI 기업 브리핑 가짜 응답(개발·테스트용). 실제 LLM 없이 입력만으로 검증을 통과하는 문장을 만든다.

주제(OVERVIEW·PRODUCTS·SALES·RISK)마다 첫 원문 하나를 인용한 문장 하나다. 같은 입력이면 늘 같은
결과다. 결과에는 모델 이름 `fake-model`이 남아 실제 브리핑과 구분된다.
"""

from __future__ import annotations

import re
from typing import Any

from app.briefing.model import OVERVIEW, PRODUCTS, RISK, SALES, TOPICS, BriefingInput
from app.briefing.prompt import MAX_SENTENCES
from app.llm.providers import LlmRequest

SNIPPET_CHARS = 50
_SPACES = re.compile(r"\s+")
_TRAILING_NUMBER = re.compile(r"[\d,.]+$")
LABELS = {
    OVERVIEW: "사업 개요",
    PRODUCTS: "주요 제품·서비스",
    SALES: "매출",
    RISK: "회사가 밝힌 위험",
}


def respond(request: LlmRequest) -> dict[str, Any]:
    briefing = request.context
    if not isinstance(briefing, BriefingInput):
        return {"sentences": []}
    sentences = []
    for topic in TOPICS:
        source = next((s for s in briefing.sources if s.topic == topic), None)
        if source is None:
            continue
        text = f"{LABELS[topic]}: 원문에 '{snippet(source.text)}'라고 적혀 있어요."
        sentences.append({"text": text, "evidenceIds": [source.evidence_id]})
    return {"sentences": sentences[:MAX_SENTENCES]}


def snippet(text: str) -> str:
    """원문 앞부분을 낱말 단위로 자른다. 숫자가 중간에서 잘려 숫자 검증에 걸리지 않게 한다."""
    flat = _SPACES.sub(" ", text.replace("[", "(").replace("]", ")")).strip()
    if len(flat) <= SNIPPET_CHARS:
        return flat
    cut = flat[:SNIPPET_CHARS]
    if flat[SNIPPET_CHARS] != " ":
        cut = cut.rsplit(" ", 1)[0] if " " in cut else _TRAILING_NUMBER.sub("", cut)
    return cut.rstrip() + "…"
