"""두 보고서 사이 활동 가짜 응답(개발·테스트용).

실제 LLM 없이 입력만으로 검증을 통과하는 카드를 만든다. 이번 보고서 글이 있는 변경을
목차가 겹치지 않게 앞에서부터 고르고, 그 글의 첫 문장을 그대로 인용한다. 신호는 '그 밖의 사건'
(보류), 영향은 숫자 없는 확인할 점 한 줄이다. 같은 입력이면 늘 같은 결과다.
결과에는 모델 이름 `fake-model`이 남아 실제 결과와 구분된다.
"""

from __future__ import annotations

import re
from typing import Any

from app.activity.model import (
    AUDIENCES,
    BUSINESS,
    CHECK,
    CURRENT,
    FINANCE,
    GOVERNANCE,
    OTHER,
    RISK,
    SHAREHOLDER,
    ActivityInput,
)
from app.activity.validate import MIN_QUOTE, normalize
from app.llm.providers import LlmRequest

MAX_FAKE_ITEMS = 6
SUMMARY = "이번 보고서에서 이 항목의 내용이 바뀌었어요."
CHECK_TEXT = "다음 보고서에서 이 내용이 어떻게 이어지는지 확인해 보세요."
OVERVIEW = (
    "이전 보고서와 비교해 바뀐 내용 중 눈여겨볼 활동을 골랐어요. 실제 모델이 아닌 가짜 응답이에요."
)
# 문장 변화 분야(app.compare.listing) → 카드 분야
FIELD_AREAS = {
    "LITIGATION": RISK,
    "CONTRACT": BUSINESS,
    "FUNDING": FINANCE,
    "DIVIDEND": SHAREHOLDER,
    "SHAREHOLDER": SHAREHOLDER,
    "AUDIT": GOVERNANCE,
    "BOARD": GOVERNANCE,
    "BUSINESS": BUSINESS,
}
_SENTENCE = re.compile(r"[^.!?]*[.!?]")
_NUMBERING = re.compile(r"[\dⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+[.)]\s*|\d")


def respond(request: LlmRequest) -> dict[str, Any]:
    activity = request.context
    if not isinstance(activity, ActivityInput):
        return {"overview": None, "items": []}
    items: list[dict[str, Any]] = []
    seen_sections: set[str] = set()
    for source in activity.sources:
        if source.side != CURRENT or source.section_path in seen_sections:
            continue
        quote = first_sentence(normalize(source.text))
        title = title_of(source.section_path)
        if len(quote) < MIN_QUOTE or not title:
            continue
        seen_sections.add(source.section_path)
        items.append(
            {
                "area": FIELD_AREAS.get(source.field or "", OTHER),
                "audiences": list(AUDIENCES),
                "title": title,
                "summary": SUMMARY,
                "facts": [{"quote": quote, "evidenceId": source.evidence_id}],
                "signalKind": OTHER,
                "signalChange": OTHER,
                "signalEvidenceId": source.evidence_id,
                "impacts": [{"kind": CHECK, "tone": None, "text": CHECK_TEXT, "premises": []}],
            }
        )
        if len(items) == MAX_FAKE_ITEMS:
            break
    if not items:
        return {"overview": None, "items": []}
    first = items[0]["facts"][0]["evidenceId"]
    return {"overview": {"text": OVERVIEW, "evidenceIds": [first]}, "items": items}


def first_sentence(text: str) -> str:
    match = _SENTENCE.match(text)
    sentence = (match.group(0) if match else text).strip()
    return sentence[:300]


def title_of(section_path: str) -> str:
    """목차 경로의 마지막 제목에서 번호·숫자를 뺀 글(숫자 검사를 늘 통과하게)."""
    last = section_path.split(">")[-1]
    return " ".join(_NUMBERING.sub(" ", last).split())[:60]
