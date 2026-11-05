"""금액 후보가 그 사건의 금액인지 확인하기(2.18, ADR-0058). LLM은 app.llm.LlmClient로만 부른다.

후보가 하나여도 부른다. null이면 금액 없음이다. 호출 실패, 읽을 수 없는 답, 없는 번호여도
(최대 2회 다시 만든 뒤) 금액 없음이다. 실패가 사건 묶기 전체의 실패가 되지 않는다.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

from app.events.amount_pick_prompt import build_request
from app.events.amounts import AmountCandidate
from app.events.model import AI_CHOICE, AMOUNT_NONE, TextEvent
from app.llm import CallRecord, LlmClient, LlmOutputInvalid, LlmUnavailable, OutputProblem

# 표의 숫자 칸이 많아도 프롬프트가 커지지 않게 원화 값이 큰 후보만 보여 준다
MAX_SHOWN = 30

KrwOf = Callable[[AmountCandidate], int | None]


@dataclass(frozen=True)
class Picked:
    candidate: AmountCandidate | None
    source: str
    calls: list[CallRecord] = field(default_factory=list)
    unavailable: bool = False


def no_amount(calls: list[CallRecord] | None = None, unavailable: bool = False) -> Picked:
    return Picked(None, AMOUNT_NONE, calls or [], unavailable)


def _shown(candidates: list[AmountCandidate], krw_of: KrwOf) -> list[AmountCandidate]:
    if len(candidates) <= MAX_SHOWN:
        return candidates
    largest = sorted(candidates, key=lambda c: krw_of(c) or 0, reverse=True)[:MAX_SHOWN]
    kept = {id(c) for c in largest}
    return [c for c in candidates if id(c) in kept]


def pick_amount(
    llm: LlmClient, event: TextEvent, candidates: list[AmountCandidate], krw_of: KrwOf
) -> Picked:
    shown = _shown(candidates, krw_of)

    def validate(data: object) -> AmountCandidate | None:
        if not isinstance(data, dict) or "choice" not in data:
            raise OutputProblem(['{"choice": 번호} 또는 {"choice": null}로 답하세요.'])
        choice = data["choice"]
        if choice is None:
            return None
        if type(choice) is not int or not 1 <= choice <= len(shown):
            raise OutputProblem(
                [f"choice는 1부터 {len(shown)}까지의 번호이거나 null이어야 합니다."]
            )
        return shown[choice - 1]

    try:
        generated = llm.generate(build_request(event, shown), validate)
    except LlmOutputInvalid as e:
        return no_amount(e.calls)
    except LlmUnavailable as e:
        return no_amount(e.calls, unavailable=True)
    if generated.value is None:
        return no_amount(generated.calls)
    return Picked(generated.value, AI_CHOICE, generated.calls)
