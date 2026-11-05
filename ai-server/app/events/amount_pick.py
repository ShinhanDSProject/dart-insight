"""금액 후보가 여럿일 때 번호 고르기(2.16, ADR-0053). LLM은 app.llm.LlmClient로만 부른다.

null이면 금액 없음이다. 호출 실패, 읽을 수 없는 답, 없는 번호면(최대 2회 다시 만든 뒤)
규칙으로 대체한다: 합계·한도 표시 후보를 빼고 원화 값이 가장 큰 것.
실패가 사건 묶기 전체의 실패가 되지 않는다.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

from app.events.amount_pick_prompt import build_request
from app.events.amounts import AmountCandidate
from app.events.model import AI_CHOICE, AMOUNT_NONE, RULE_FALLBACK
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


def rule_choice(candidates: list[AmountCandidate], krw_of: KrwOf) -> AmountCandidate | None:
    usable = [c for c in candidates if not c.total_like]
    converted = [c for c in usable if krw_of(c) is not None]
    if converted:
        return max(converted, key=lambda c: krw_of(c) or 0)
    return max(usable, key=lambda c: c.value, default=None)


def by_rule(
    candidates: list[AmountCandidate],
    krw_of: KrwOf,
    calls: list[CallRecord] | None = None,
    unavailable: bool = False,
) -> Picked:
    chosen = rule_choice(candidates, krw_of)
    source = RULE_FALLBACK if chosen else AMOUNT_NONE
    return Picked(chosen, source, calls or [], unavailable)


def _shown(candidates: list[AmountCandidate], krw_of: KrwOf) -> list[AmountCandidate]:
    if len(candidates) <= MAX_SHOWN:
        return candidates
    largest = sorted(candidates, key=lambda c: krw_of(c) or 0, reverse=True)[:MAX_SHOWN]
    kept = {id(c) for c in largest}
    return [c for c in candidates if id(c) in kept]


def pick_amount(
    llm: LlmClient, title: str, kind: str, candidates: list[AmountCandidate], krw_of: KrwOf
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
        generated = llm.generate(build_request(title, kind, shown), validate)
    except LlmOutputInvalid as e:
        return by_rule(candidates, krw_of, e.calls)
    except LlmUnavailable as e:
        return by_rule(candidates, krw_of, e.calls, unavailable=True)
    source = AI_CHOICE if generated.value else AMOUNT_NONE
    return Picked(generated.value, source, generated.calls)
