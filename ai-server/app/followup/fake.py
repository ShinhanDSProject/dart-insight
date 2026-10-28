"""약속과 실제 대조 가짜 응답(개발·테스트용).

실제 LLM 없이 입력만으로 검증을 통과하는 답을 만든다. 계획마다 첫 후보 문단의 첫 문장을
그대로 인용하고, 그 문장에 변경 낱말(연기·중단·보류 등)이 있으면 CHANGED, 아니면 MENTIONED다.
후보가 없거나 첫 문장이 짧으면 NOT_FOUND다. 요지는 숫자 없는 정해진 문장이다.
같은 입력이면 늘 같은 결과다. 결과에는 모델 이름 `fake-model`이 남아 실제 결과와 구분된다.
"""

from __future__ import annotations

import re
from typing import Any

from app.followup.model import CHANGED, MENTIONED, NOT_FOUND, FollowupInput
from app.followup.validate import MAX_QUOTE, MIN_QUOTE, normalize
from app.llm.providers import LlmRequest

CHANGE_WORDS = ("연기", "중단", "보류", "철회", "취소", "변경", "축소")
MENTIONED_SUMMARY = "올해 보고서에 이 계획과 관련된 내용을 적었어요."
CHANGED_SUMMARY = "올해 보고서에 이 계획이 바뀌었다는 내용을 적었어요."
_SENTENCE = re.compile(r"[^.!?]*[.!?]")


def respond(request: LlmRequest) -> dict[str, Any]:
    followup = request.context
    if not isinstance(followup, FollowupInput):
        return {"followups": []}
    answers = []
    for plan in followup.plans:
        quote = first_sentence(normalize(plan.candidates[0].text)) if plan.candidates else ""
        if len(quote) < MIN_QUOTE:
            answers.append(_not_found(plan.plan_id))
            continue
        changed = any(w in quote for w in CHANGE_WORDS)
        answers.append(
            {
                "planId": plan.plan_id,
                "status": CHANGED if changed else MENTIONED,
                "summary": CHANGED_SUMMARY if changed else MENTIONED_SUMMARY,
                "quote": quote,
                "evidenceIds": [plan.candidates[0].evidence_id],
            }
        )
    return {"followups": answers}


def first_sentence(text: str) -> str:
    match = _SENTENCE.match(text)
    sentence = (match.group(0) if match else text).strip()
    return sentence[:MAX_QUOTE]


def _not_found(plan_id: str) -> dict[str, Any]:
    return {
        "planId": plan_id,
        "status": NOT_FOUND,
        "summary": None,
        "quote": None,
        "evidenceIds": [],
    }
