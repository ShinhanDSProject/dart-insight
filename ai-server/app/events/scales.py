"""사건마다 규모 정하기(2.16, ADR-0053).

구조화 값 → 후보 없으면 금액 없음 → AI 확인(ADR-0058) 순서다. 숫자는 코드만 만든다.
LLM을 쓸 수 없다고 판명되거나 예산을 넘기면 나머지 사건은 부르지 않고 확인하지 못한 것으로 남긴다.
사건끼리 금액을 더하지 않는다(ADR-0050).
"""

from __future__ import annotations

import re
import time
from collections.abc import Callable
from dataclasses import replace
from decimal import ROUND_HALF_UP, Decimal

from app.documents.parser import TABLE
from app.events.amount_pick import KrwOf, Picked, not_checked, pick_amount
from app.events.amounts import KRW, AmountCandidate, AmountSource, extract_amounts
from app.events.fx import Converted, Rates, load_rates, to_krw
from app.events.model import (
    AMOUNT_NONE,
    CURRENT,
    EQUITY_MISSING,
    EQUITY_NOT_POSITIVE,
    FX_RATE_MISSING,
    PREVIOUS,
    STRUCTURED,
    EventChange,
    EventInput,
    EventScale,
    StructuredAmount,
    TextEvent,
)
from app.llm import CallRecord, LlmClient

_RATIO_DIGITS = Decimal("0.000001")
# 금액 고르기 전체 시간. 2.12 최대 약 165초(ADR-0057). 넘으면 남은 사건은 확인하지 못한 것이다
PICK_BUDGET_SECONDS = 240.0

# 사건의 제목·종류와 주요사항보고서 종류(backend KeyItemKind)를 잇는 낱말. 소송은 금액 항목이 없다
_STRUCTURED_KINDS = {
    "CAPITAL_INCREASE": re.compile(r"유상증자|제3자\s*배정"),
    "CONVERTIBLE_BOND": re.compile(r"전환사채"),
    "BOND_WITH_WARRANT": re.compile(r"신주인수권부사채"),
    "EXCHANGEABLE_BOND": re.compile(r"교환사채"),
    "TREASURY_STOCK_ACQUISITION": re.compile(r"자기주식\s*취득|자사주\s*취득"),
    "TREASURY_STOCK_DISPOSAL": re.compile(r"자기주식\s*처분|자사주\s*처분"),
    "STOCK_ACQUISITION": re.compile(r"타법인\s*주식|출자증권"),
}


def _structured_by_event(
    events: list[TextEvent], structured: list[StructuredAmount]
) -> dict[int, StructuredAmount]:
    """그 종류의 결정과 사건이 각각 딱 1개일 때만 잇는다."""
    matched: dict[int, StructuredAmount] = {}
    for kind, pattern in _STRUCTURED_KINDS.items():
        decisions = [s for s in structured if s.kind == kind]
        matches = [i for i, e in enumerate(events) if pattern.search(f"{e.title} {e.kind}")]
        if len(decisions) == 1 and len(matches) == 1:
            matched[matches[0]] = decisions[0]
    return matched


def _sources(
    event: TextEvent, changes: dict[int, EventChange], data: EventInput
) -> list[AmountSource]:
    """사건 변경의 이번 글(없으면 이전 글). 원문 위치가 없으면 근거가 없어 뺀다."""
    sources: list[AmountSource] = []
    for change_no in event.change_nos:
        change = changes[change_no]
        side = CURRENT if change.current_text else PREVIOUS
        text = change.current_text or change.previous_text
        block_no = change.block_no(side)
        if not text or block_no is None:
            continue
        sources.append(
            AmountSource(
                change_no,
                f"{data.rcept_no(side)}#B{block_no}",
                text,
                change.attrs.block_type == TABLE,
                change.preceding_block_text,
            )
        )
    return sources


def _ratio(krw: int | None, data: EventInput) -> tuple[float | None, str | None]:
    if krw is None:
        return None, FX_RATE_MISSING
    if data.equity_total is None or data.currency != KRW:
        return None, EQUITY_MISSING
    if data.equity_total <= 0:
        return None, EQUITY_NOT_POSITIVE
    ratio = Decimal(krw) / Decimal(data.equity_total)
    return float(ratio.quantize(_RATIO_DIGITS, rounding=ROUND_HALF_UP)), None


def _scale(
    amount: Decimal,
    currency: str,
    text: str,
    evidence_id: str,
    source: str,
    converted: Converted,
    data: EventInput,
) -> EventScale:
    ratio, reason = _ratio(converted.krw, data)
    rounded = int(amount.quantize(Decimal(1), rounding=ROUND_HALF_UP))
    return EventScale(
        rounded,
        text,
        currency,
        converted.krw,
        ratio,
        reason,
        evidence_id,
        source,
        converted.source,
        converted.rate_date,
    )


def _from_structured(item: StructuredAmount, data: EventInput, table: Rates) -> EventScale:
    amount = Decimal(item.amount)
    text = f"{item.amount:,}원" if item.currency == KRW else f"{item.currency} {item.amount:,}"
    converted = to_krw(item.currency, amount, {}, data.report_base_date, table)
    evidence_id = f"{item.rcept_no}#{item.field}"
    return _scale(amount, item.currency, text, evidence_id, STRUCTURED, converted, data)


def _choose(
    llm: LlmClient,
    event: TextEvent,
    candidates: list[AmountCandidate],
    krw_of: KrwOf,
    llm_down: bool,
) -> Picked:
    if not candidates:
        return Picked(None, AMOUNT_NONE)
    if llm_down:
        return not_checked()
    return pick_amount(llm, event, candidates, krw_of)


def _from_text(
    llm: LlmClient,
    event: TextEvent,
    sources: list[AmountSource],
    data: EventInput,
    table: Rates,
    llm_down: bool,
) -> tuple[EventScale, Picked]:
    extracted = extract_amounts(sources)

    def convert(candidate: AmountCandidate) -> Converted:
        disclosed = extracted.disclosed_rates
        return to_krw(candidate.currency, candidate.value, disclosed, data.report_base_date, table)

    picked = _choose(llm, event, extracted.candidates, lambda c: convert(c).krw, llm_down)
    chosen = picked.candidate
    if chosen is None:
        return EventScale(source=picked.source), picked
    scale = _scale(
        chosen.value,
        chosen.currency,
        chosen.text,
        chosen.evidence_id,
        picked.source,
        convert(chosen),
        data,
    )
    return scale, picked


def scale_events(
    llm: LlmClient,
    data: EventInput,
    events: list[TextEvent],
    table: Rates | None = None,
    monotonic: Callable[[], float] = time.monotonic,
) -> tuple[list[TextEvent], list[CallRecord]]:
    rates = load_rates() if table is None else table
    changes = {c.change_no: c for c in data.changes}
    structured = _structured_by_event(events, data.structured_amounts)
    calls: list[CallRecord] = []
    llm_down = False
    started = monotonic()
    scaled: list[TextEvent] = []
    for index, event in enumerate(events):
        if index in structured:
            scaled.append(replace(event, scale=_from_structured(structured[index], data, rates)))
            continue
        sources = _sources(event, changes, data)
        llm_down = llm_down or monotonic() - started >= PICK_BUDGET_SECONDS
        scale, picked = _from_text(llm, event, sources, data, rates, llm_down)
        calls += picked.calls
        llm_down = llm_down or picked.unavailable
        scaled.append(replace(event, scale=scale))
    return scaled, calls
