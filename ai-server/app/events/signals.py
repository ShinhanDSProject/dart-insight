"""사건 신호 붙이기(2.21, ADR-0060). LLM을 쓰지 않는다.

AI는 묶을 때 기준표의 종류·변화와 그 근거만 고르고(prompt.py), 신호는 이 모듈이 기준표
(signal_table.json)로 붙인다. 기준표를 읽는 곳은 이 모듈 하나다. 아래 순서로 본다.

1. 종류·변화가 기준표에 없으면 보류(NO_CRITERIA). 종류는 '그 밖의 사건'이다.
2. 근거가 그 사건의 검증된 인용이 아니면 보류(EVIDENCE_NOT_CONFIRMED). 해소·철회·취소·종료
   (explicitOnly)는 이번 보고서 쪽 인용이어야 한다. 이전 글이 삭제된 것만으로는 아니다.
3. 소송이고 묶인 표의 바뀐·새·이번엔 없는 행이 합쳐 2행 이상이면 보류(MIXED_LITIGATION).
4. 기준표의 신호. 없으면 보류(NO_CRITERIA), 좋은 면·나쁜 면이 함께 있으면 보류(MIXED_SIDES).

맨 앞 종류(ordering.py)는 기준표에서 front인 종류의 '새로 발생'이고 2번까지 통과했으며 근거가
이번 보고서 쪽 인용일 때다.

규모는 신호에 들어가지 않는다. 결과가 달라지게 바꾸면(이 모듈, 기준표) 기준표 version과
backend TextEvents.EVENT_VERSION을 올린다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, replace
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.events.model import (
    CAUTION,
    CURRENT,
    EVIDENCE_NOT_CONFIRMED,
    HOLD,
    MIXED_LITIGATION,
    MIXED_SIDES,
    NO_CRITERIA,
    POSITIVE,
    EventChange,
    EventSignal,
    FactAccount,
    GlossaryTerm,
    TextEvent,
)

TABLE_FILE = Path(__file__).with_name("signal_table.json")

OTHER = "OTHER"
LITIGATION = "LITIGATION"
OCCURRED = "OCCURRED"
# 기준표의 신호 값. MIXED는 밖으로 HOLD·MIXED_SIDES로 낸다
MIXED = "MIXED"
# 이 행 수부터 여러 소송의 진행 상황이 섞인 것으로 본다(ADR-0060)
MIXED_LITIGATION_ROWS = 2


@dataclass(frozen=True)
class TableChange:
    code: str
    name: str
    signal: str | None
    explicit_only: bool


@dataclass(frozen=True)
class TableKind:
    code: str
    name: str
    front: bool
    changes: tuple[TableChange, ...]
    accounts: tuple[str, ...]
    accounts_by_type: dict[str, tuple[str, ...]] | None
    general_sides: dict[str, str] | None

    def change(self, code: str | None) -> TableChange | None:
        return next((c for c in self.changes if c.code == code), None)


@dataclass(frozen=True)
class SignalTable:
    version: str
    notice: str
    kinds: tuple[TableKind, ...]
    glossary: tuple[GlossaryTerm, ...]

    def kind(self, code: str | None) -> TableKind | None:
        return next((k for k in self.kinds if k.code == code), None)


@lru_cache(maxsize=1)
def load_table(path: Path = TABLE_FILE) -> SignalTable:
    """기준표. 파일은 한 번만 읽는다. 형식은 tests/events/test_signal_table.py가 확인한다."""
    data = json.loads(path.read_text(encoding="utf-8"))
    return SignalTable(
        data["version"],
        data["signalNotice"],
        tuple(_kind(k) for k in data["kinds"]),
        tuple(GlossaryTerm(g["term"], g["meaning"], g["source"]) for g in data["glossary"]),
    )


def _kind(data: dict[str, Any]) -> TableKind:
    by_type = data.get("accountsByType")
    return TableKind(
        data["code"],
        data["name"],
        data["front"],
        tuple(
            TableChange(c["code"], c["name"], c["signal"], c.get("explicitOnly", False))
            for c in data["changes"]
        ),
        tuple(data["accounts"]),
        {t: tuple(names) for t, names in by_type.items()} if by_type else None,
        data.get("generalSides"),
    )


def kind_name(code: str | None, table: SignalTable | None = None) -> str:
    """종류 코드의 기준표 이름. 기준표에 없으면 '그 밖의 사건'."""
    table = table or load_table()
    kind = table.kind(code) or table.kind(OTHER)
    assert kind is not None
    return kind.name


def attach_signals(
    events: list[TextEvent], changes: dict[int, EventChange], table: SignalTable | None = None
) -> list[TextEvent]:
    table = table or load_table()
    return [replace(e, signal=_judge(e, changes, table)) for e in events]


def attach_glossary(events: list[TextEvent], table: SignalTable | None = None) -> list[TextEvent]:
    """출처를 확인했고 그 사건 인용에 나오는 용어만 붙인다(ADR-0060). AI를 부르지 않는다."""
    table = table or load_table()
    sourced = [g for g in table.glossary if g.source]
    return [
        replace(e, glossary=tuple(g for g in sourced if any(g.term in q.text for q in e.quotes)))
        for e in events
    ]


def _judge(event: TextEvent, changes: dict[int, EventChange], table: SignalTable) -> EventSignal:
    pick = event.pick
    kind = table.kind(pick.kind_code)
    change = kind.change(pick.change_code) if kind else None
    if kind is None or change is None:
        other = table.kind(OTHER)
        assert other is not None
        return EventSignal(OTHER, OTHER, other.changes[0].name, HOLD, NO_CRITERIA)
    base = EventSignal(
        kind.code, change.code, change.name, HOLD, fact_accounts=_fact_accounts(kind)
    )
    quoted = {q.evidence_id for q in event.quotes}
    confirmed = pick.evidence_id in quoted and (not change.explicit_only or pick.side == CURRENT)
    if not confirmed:
        return replace(base, hold_reason=EVIDENCE_NOT_CONFIRMED)
    base = replace(base, evidence_id=pick.evidence_id)
    if kind.code == LITIGATION and _changed_rows(event, changes) >= MIXED_LITIGATION_ROWS:
        return replace(base, hold_reason=MIXED_LITIGATION)
    # 새로 발생은 이번 보고서 글이 근거일 때만 맨 앞에 둔다
    front = kind.front and change.code == OCCURRED and pick.side == CURRENT
    if change.signal in (CAUTION, POSITIVE):
        return replace(base, signal=change.signal, front=front)
    reason = MIXED_SIDES if change.signal == MIXED else NO_CRITERIA
    return replace(base, hold_reason=reason, front=front)


def _changed_rows(event: TextEvent, changes: dict[int, EventChange]) -> int:
    counts = [changes[no].row_counts for no in event.change_nos]
    return sum(c.total for c in counts if c is not None)


def _fact_accounts(kind: TableKind) -> tuple[FactAccount, ...]:
    if kind.accounts_by_type:
        return tuple(
            FactAccount(name, account_type)
            for account_type, names in kind.accounts_by_type.items()
            for name in names
        )
    return tuple(FactAccount(name) for name in kind.accounts)


def table_json(table: SignalTable | None = None) -> dict[str, Any]:
    """GET /internal/signal-tables/current의 응답. 출처를 확인하지 못한 용어는 넣지 않는다."""
    table = table or load_table()
    return {
        "version": table.version,
        "signalNotice": table.notice,
        "kinds": [
            {
                "code": k.code,
                "name": k.name,
                "front": k.front,
                "changes": [
                    {
                        "code": c.code,
                        "name": c.name,
                        "signal": c.signal,
                        "explicitOnly": c.explicit_only,
                    }
                    for c in k.changes
                ],
                "accounts": list(k.accounts),
                "accountsByType": (
                    {t: list(names) for t, names in k.accounts_by_type.items()}
                    if k.accounts_by_type
                    else None
                ),
                "generalSides": k.general_sides,
            }
            for k in table.kinds
        ],
        "glossary": [
            {"term": g.term, "meaning": g.meaning, "source": g.source}
            for g in table.glossary
            if g.source
        ],
    }
