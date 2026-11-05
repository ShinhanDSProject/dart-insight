"""사건 순서 정하기(2.16, ADR-0053). LLM을 쓰지 않는다.

맨 앞 종류, 금액, 바뀐 단위 수, 문서 순서다. 금액은 원화 값으로 비교한다. 같은 통화끼리는
자본총계 대비 비율 순서와 같아서 자본총계가 없어도 정렬할 수 있다. 원화 값을 모르는 외화는
금액 모르는 사건과 같은 줄이다.

맨 앞 종류는 tests/fixtures/events/README.md의 8종이다.
낱말은 도메인 가이드와 아직 대조하지 못했다(#640).
결과가 달라지게 바꾸면 backend TextEvents.EVENT_VERSION을 올린다.
"""

from __future__ import annotations

import re
from dataclasses import replace

from app.events.model import AMOUNT, FRONT_KIND, UNIT_COUNT, EventChange, TextEvent

_FRONT_KINDS = (
    re.compile(r"비적정|부적정|의견\s*거절|한정의견"),
    re.compile(r"계속기업.{0,30}(?:불확실|의문)"),
    re.compile(r"회생절차"),
    re.compile(r"영업정지"),
    re.compile(r"횡령|배임"),
    re.compile(r"부도\s*발생"),
    re.compile(r"해산\s*사유"),
    re.compile(r"채권은행.{0,20}관리절차"),
)


def is_front_kind(event: TextEvent, changes: dict[int, EventChange]) -> bool:
    """AI가 쓴 제목·종류와 묶인 이번 글에 있고 묶인 이전 글에 없으면 새로 발생한 것으로 본다."""
    linked = [changes[no] for no in event.change_nos]
    written = f"{event.title} {event.kind}"
    current = " ".join(c.current_text or "" for c in linked)
    previous = " ".join(c.previous_text or "" for c in linked)
    return any(
        pattern.search(written) and pattern.search(current) and not pattern.search(previous)
        for pattern in _FRONT_KINDS
    )


def _basis(event: TextEvent, changes: dict[int, EventChange]) -> str:
    if is_front_kind(event, changes):
        return FRONT_KIND
    return AMOUNT if event.scale.krw is not None else UNIT_COUNT


def rank(events: list[TextEvent], changes: dict[int, EventChange]) -> list[TextEvent]:
    tiers = {FRONT_KIND: 0, AMOUNT: 1, UNIT_COUNT: 2}

    def key(event: TextEvent) -> tuple[int, int, int, int]:
        units = sum(changes[no].changed_unit_count for no in event.change_nos)
        return (tiers[event.basis], -(event.scale.krw or 0), -units, min(event.change_nos))

    based = [replace(e, basis=_basis(e, changes)) for e in events]
    return sorted(based, key=key)
