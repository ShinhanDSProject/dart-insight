"""사건 순서 정하기(2.16, ADR-0053). LLM을 쓰지 않는다.

맨 앞 종류, 금액, 바뀐 단위 수, 문서 순서다. 금액은 원화 값으로 비교한다. 같은 통화끼리는
자본총계 대비 비율 순서와 같아서 자본총계가 없어도 정렬할 수 있다. 원화 값을 모르는 외화는
금액 모르는 사건과 같은 줄이다.

맨 앞 종류는 기준표에서 front인 종류가 새로 발생했고 그 근거를 확인한 사건이다(signals.py,
ADR-0060). 신호는 순서를 바꾸지 않는다. 결과가 달라지게 바꾸면 backend
TextEvents.EVENT_VERSION을 올린다.
"""

from __future__ import annotations

from dataclasses import replace

from app.events.model import AMOUNT, FRONT_KIND, UNIT_COUNT, EventChange, TextEvent


def _basis(event: TextEvent) -> str:
    if event.signal is not None and event.signal.front:
        return FRONT_KIND
    return AMOUNT if event.scale.krw is not None else UNIT_COUNT


def rank(events: list[TextEvent], changes: dict[int, EventChange]) -> list[TextEvent]:
    tiers = {FRONT_KIND: 0, AMOUNT: 1, UNIT_COUNT: 2}

    def key(event: TextEvent) -> tuple[int, int, int, int]:
        units = sum(changes[no].changed_unit_count for no in event.change_nos)
        return (tiers[event.basis], -(event.scale.krw or 0), -units, min(event.change_nos))

    based = [replace(e, basis=_basis(e)) for e in events]
    return sorted(based, key=key)
