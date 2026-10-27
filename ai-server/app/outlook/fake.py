"""회사가 밝힌 전망·계획 가짜 응답(개발·테스트용).

실제 LLM 없이 입력만으로 검증을 통과하는 항목을 만든다. 계획·전망 낱말이 든 원문의
첫 문장을 그대로 인용하고, 숫자 없는 요지를 붙인다(원문 하나에 항목 하나).
같은 입력이면 늘 같은 결과다. 결과에는 모델 이름 `fake-model`이 남아 실제 결과와 구분된다.
"""

from __future__ import annotations

import re
from typing import Any

from app.llm.providers import LlmRequest
from app.outlook.model import FINANCIAL, INVESTMENT, MARKET, NEW_BUSINESS, OTHER, OutlookInput
from app.outlook.prompt import MAX_ITEMS
from app.outlook.validate import MAX_QUOTE, MIN_QUOTE, normalize

PLAN_WORDS = ("계획", "예정", "목표", "전망", "추진", "확대", "신규", "출시", "증설")
# 앞에 있는 낱말이 먼저 정한다
CATEGORY_WORDS = (
    (INVESTMENT, ("투자", "설비", "증설", "공장", "라인")),
    (NEW_BUSINESS, ("신규", "출시", "신제품", "개발")),
    (FINANCIAL, ("배당", "자기주식", "차입", "재무")),
    (MARKET, ("시장", "수요", "업황", "전망")),
)
SUMMARY = "회사가 원문에 이 계획·전망을 밝혔어요."
_SENTENCE = re.compile(r"[^.!?]*[.!?]")


def respond(request: LlmRequest) -> dict[str, Any]:
    outlook = request.context
    if not isinstance(outlook, OutlookInput):
        return {"items": []}
    items = []
    for source in outlook.sources:
        quote = first_sentence(normalize(source.text))
        if len(quote) < MIN_QUOTE or not any(w in quote for w in PLAN_WORDS):
            continue
        items.append(
            {
                "category": category(quote),
                "summary": SUMMARY,
                "quote": quote,
                "evidenceIds": [source.evidence_id],
            }
        )
    return {"items": items[:MAX_ITEMS]}


def first_sentence(text: str) -> str:
    match = _SENTENCE.match(text)
    sentence = (match.group(0) if match else text).strip()
    return sentence[:MAX_QUOTE]


def category(quote: str) -> str:
    for name, words in CATEGORY_WORDS:
        if any(w in quote for w in words):
            return name
    return OTHER
