from decimal import Decimal

from app.compare.listing import LITIGATION, MAIN
from app.compare.text_diff import MODIFIED
from app.core.config import LlmSettings
from app.documents.parser import PARAGRAPH, TABLE
from app.events.candidates import CandidateChange
from app.events.model import (
    AI_CHOICE,
    AMOUNT_NONE,
    AMOUNT_UNAVAILABLE,
    EQUITY_MISSING,
    EQUITY_NOT_POSITIVE,
    FX_RATE_MISSING,
    STRUCTURED,
    EventChange,
    EventInput,
    StructuredAmount,
    TextEvent,
)
from app.events.scales import scale_events
from app.llm import FakeProvider, LlmClient, ProviderError

PREVIOUS = "20250814003156"
CURRENT = "20260814003699"
BASE_DATE = "2026-06-30"
HARMAN = "Harman은 미국 법무부에 벌금 USD 11,800,000을 납부했습니다."


class ScriptedProvider(FakeProvider):
    name = "scripted"


def llm(*script: object) -> tuple[LlmClient, ScriptedProvider]:
    provider = ScriptedProvider(script=script, model="scripted-model")
    settings = LlmSettings(provider="scripted", max_retries=0, max_output_retries=2)
    return LlmClient(provider, settings, sleep=lambda _: None), provider


def change(
    no: int = 1,
    current: str | None = "내용",
    previous: str | None = None,
    block: int | None = 100,
    block_type: str = PARAGRAPH,
    preceding: str | None = None,
) -> EventChange:
    return EventChange(
        no,
        CandidateChange(MODIFIED, block_type, MAIN, LITIGATION, False, "XI. 그 밖에"),
        200 if previous else None,
        block,
        previous,
        current,
        1,
        preceding,
    )


def event_input(
    *changes: EventChange,
    equity: int | None = 10**12,
    currency: str | None = "KRW",
    structured: list[StructuredAmount] | None = None,
) -> EventInput:
    return EventInput(
        PREVIOUS, CURRENT, list(changes), equity, currency, BASE_DATE, structured or []
    )


def text_event(*change_nos: int, title: str = "사건", kind: str = "소송") -> TextEvent:
    return TextEvent(title, kind, list(change_nos), [])


def one(client: LlmClient, data: EventInput, event: TextEvent | None = None, fx=None):  # noqa: ANN001, ANN201
    scaled, calls = scale_events(client, data, [event or text_event(1)], fx or {})
    return scaled[0].scale, calls


def test_no_candidate_means_no_amount_without_calling_model() -> None:
    client, provider = llm()

    scale, calls = one(client, event_input(change()))

    assert scale.source == AMOUNT_NONE
    assert scale.amount is None
    assert scale.krw is None
    assert scale.ratio is None
    assert scale.reason is None
    assert scale.fx_source is None
    assert provider.requests == []
    assert calls == []


def test_one_candidate_is_used_when_model_confirms_it() -> None:
    client, provider = llm({"choice": 1})

    scale, calls = one(client, event_input(change(current="과징금 8,428.1백만원을 납부")))

    assert scale.source == AI_CHOICE
    assert scale.amount == 8_428_100_000
    assert scale.text == "8,428.1백만원"
    assert scale.currency == "KRW"
    assert scale.krw == 8_428_100_000
    assert scale.ratio == 0.008428
    assert scale.evidence_id == f"{CURRENT}#B100"
    assert len(provider.requests) == 1
    assert len(calls) == 1


def test_one_candidate_the_model_rejects_gives_no_amount() -> None:
    client, _ = llm({"choice": None})

    scale, _ = one(client, event_input(change(current="매입 예상 규모는 3,911,908백만원입니다.")))

    assert scale.source == AMOUNT_NONE
    assert scale.amount is None
    assert scale.krw is None
    assert scale.text is None
    assert scale.evidence_id is None


def test_model_choosing_first_of_mixed_text_gets_the_fine() -> None:
    text = "과징금 8,428백만원, 1주당 액면가 100원, 소송 합계 1조원"
    client, provider = llm({"choice": 1})

    scale, calls = one(client, event_input(change(current=text)))

    assert scale.amount == 8_428_000_000
    assert scale.source == AI_CHOICE
    assert "100원" not in provider.requests[0].user.split("과징금")[0]
    assert '<disclosure id="3"' not in provider.requests[0].user
    assert len(calls) == 1


def test_model_choosing_null_means_no_amount() -> None:
    client, _ = llm({"choice": None})

    scale, _ = one(client, event_input(change(current="과징금 100억원, 소송 합계 1조원")))

    assert scale.source == AMOUNT_NONE
    assert scale.amount is None


def test_model_error_is_kept_apart_from_no_amount() -> None:
    client, _ = llm(ProviderError("인증 실패"))

    scale, calls = one(client, event_input(change(current="과징금 100억원, 소송 합계 1조원")))

    assert scale.source == AMOUNT_UNAVAILABLE
    assert scale.amount is None
    assert len(calls) == 1


def test_after_provider_failure_other_events_are_not_checked_without_calling() -> None:
    client, provider = llm(ProviderError("인증 실패"))
    data = event_input(
        change(1, current="과징금 100억원, 소송 합계 1조원"),
        change(2, current="벌금 1억원", block=101),
    )

    scaled, calls = scale_events(client, data, [text_event(1), text_event(2)], {})

    assert len(provider.requests) == 1
    assert len(calls) == 1
    assert [e.scale.source for e in scaled] == [AMOUNT_UNAVAILABLE, AMOUNT_UNAVAILABLE]
    assert [e.scale.amount for e in scaled] == [None, None]


def test_events_after_the_pick_budget_are_not_checked_without_calling() -> None:
    now = [-120.0]
    client, provider = llm({"choice": 1})
    data = event_input(
        change(1, current="과징금 100억원, 소송 합계 1조원"),
        change(2, current="벌금 1억원", block=101),
    )

    def clock() -> float:
        now[0] += 120.0
        return now[0]

    scaled, calls = scale_events(client, data, [text_event(1), text_event(2)], {}, monotonic=clock)

    assert len(provider.requests) == 1
    assert len(calls) == 1
    assert [e.scale.source for e in scaled] == [AI_CHOICE, AMOUNT_UNAVAILABLE]
    assert scaled[1].scale.amount is None


def test_event_without_candidates_stays_no_amount_after_provider_failure() -> None:
    client, _ = llm(ProviderError("인증 실패"))
    data = event_input(
        change(1, current="과징금 100억원"), change(2, current="내용만 있음", block=101)
    )

    scaled, _ = scale_events(client, data, [text_event(1), text_event(2)], {})

    assert [e.scale.source for e in scaled] == [AMOUNT_UNAVAILABLE, AMOUNT_NONE]


def test_events_within_the_pick_budget_keep_calling() -> None:
    now = [-119.0]
    client, provider = llm({"choice": 1}, {"choice": 1})
    data = event_input(
        change(1, current="과징금 100억원, 소송 합계 1조원"),
        change(2, current="벌금 1억원, 과태료 2억원", block=101),
    )

    def clock() -> float:
        now[0] += 119.0
        return now[0]

    scaled, _ = scale_events(client, data, [text_event(1), text_event(2)], {}, monotonic=clock)

    assert len(provider.requests) == 2
    assert [e.scale.source for e in scaled] == [AI_CHOICE, AI_CHOICE]


def test_harman_fine_is_converted_with_reference_table_and_compared_in_won() -> None:
    client, _ = llm({"choice": 1})

    scale, _ = one(
        client, event_input(change(current=HARMAN)), fx={("USD", BASE_DATE): Decimal(1400)}
    )

    assert scale.amount == 11_800_000
    assert scale.currency == "USD"
    assert scale.text == "USD 11,800,000"
    assert scale.krw == 16_520_000_000
    assert scale.ratio == 0.01652
    assert scale.reason is None
    assert scale.fx_source == "reference_table"
    assert scale.fx_rate_date == BASE_DATE


def test_rate_in_linked_text_comes_before_table() -> None:
    client, _ = llm({"choice": 1})
    data = event_input(
        change(1, current=HARMAN), change(2, current="적용 환율 1USD = 1,500원", block=101)
    )

    scale, _ = one(client, data, text_event(1, 2), {("USD", BASE_DATE): Decimal(1400)})

    assert scale.krw == 17_700_000_000
    assert scale.fx_source == "disclosed_rate"
    assert scale.fx_rate_date is None


def test_foreign_amount_without_rate_is_shown_with_reason() -> None:
    client, _ = llm({"choice": 1})

    scale, _ = one(client, event_input(change(current=HARMAN)))

    assert scale.amount == 11_800_000
    assert scale.currency == "USD"
    assert scale.krw is None
    assert scale.ratio is None
    assert scale.reason == FX_RATE_MISSING
    assert scale.fx_source == "none"


def test_missing_equity_leaves_ratio_uncomputed_with_reason() -> None:
    client, _ = llm({"choice": 1})

    scale, _ = one(client, event_input(change(current="벌금 1억원"), equity=None))

    assert scale.krw == 100_000_000
    assert scale.ratio is None
    assert scale.reason == EQUITY_MISSING


def test_equity_in_other_currency_counts_as_missing() -> None:
    client, _ = llm({"choice": 1})

    scale, _ = one(client, event_input(change(current="벌금 1억원"), currency="USD"))

    assert scale.ratio is None
    assert scale.reason == EQUITY_MISSING


def test_zero_or_negative_equity_leaves_ratio_uncomputed_with_reason() -> None:
    client, _ = llm({"choice": 1}, {"choice": 1})

    for equity in (0, -5):
        scale, _ = one(client, event_input(change(current="벌금 1억원"), equity=equity))

        assert scale.ratio is None
        assert scale.reason == EQUITY_NOT_POSITIVE


def test_change_without_block_gives_no_candidate() -> None:
    client, _ = llm()

    scale, _ = one(client, event_input(change(current="벌금 1억원", block=None)))

    assert scale.source == AMOUNT_NONE


def test_current_text_is_read_and_previous_amount_is_not() -> None:
    client, _ = llm({"choice": 1})
    data = event_input(change(current="시설투자 28.0조원", previous="시설투자 23.1조원"))

    scale, _ = one(client, data)

    assert scale.amount == 28 * 10**12
    assert scale.source == AI_CHOICE


def test_previous_text_is_read_when_current_is_gone() -> None:
    client, _ = llm({"choice": 1})
    data = event_input(change(current=None, block=None, previous="벌금 1억원"))

    scale, _ = one(client, data)

    assert scale.amount == 100_000_000
    assert scale.evidence_id == f"{PREVIOUS}#B200"


def test_table_unit_from_preceding_block_is_used() -> None:
    client, _ = llm({"choice": 1})
    data = event_input(
        change(current="소송 금액 | 13,924,465", block_type=TABLE, preceding="(단위 : 천원)")
    )

    scale, _ = one(client, data)

    assert scale.amount == 13_924_465_000


def test_structured_amount_comes_first_without_calling_model() -> None:
    client, provider = llm()
    structured = [
        StructuredAmount(
            "20260219002746", "CAPITAL_INCREASE", "fdpp_ocsa", 2_833_562_221_325, "KRW"
        )
    ]
    data = event_input(change(current="유상증자 2조원, 총액 3조원"), structured=structured)

    scale, _ = one(client, data, text_event(1, title="제3자배정 유상증자", kind="증자"))

    assert scale.source == STRUCTURED
    assert scale.amount == 2_833_562_221_325
    assert scale.evidence_id == "20260219002746#fdpp_ocsa"
    assert scale.text == "2,833,562,221,325원"
    assert scale.krw == 2_833_562_221_325
    assert provider.requests == []


def test_structured_amount_of_other_kind_is_not_used() -> None:
    client, _ = llm()
    structured = [StructuredAmount("20260219002746", "CAPITAL_INCREASE", "fdpp_ocsa", 5, "KRW")]

    scale, _ = one(client, event_input(change(), structured=structured))

    assert scale.source == AMOUNT_NONE


def test_structured_amount_is_not_used_when_kind_has_several_decisions() -> None:
    client, _ = llm({"choice": 1})
    structured = [
        StructuredAmount(
            "20260129000003", "TREASURY_STOCK_ACQUISITION", "aqpln_prc_ostk", 1, "KRW"
        ),
        StructuredAmount(
            "20260107000715", "TREASURY_STOCK_ACQUISITION", "aqpln_prc_ostk", 2, "KRW"
        ),
    ]
    data = event_input(change(current="취득 금액 10조원"), structured=structured)

    scale, _ = one(client, data, text_event(1, title="자기주식 취득", kind="자기주식"))

    assert scale.source == AI_CHOICE
    assert scale.amount == 10 * 10**12


def test_structured_amount_is_not_used_when_two_events_match_the_kind() -> None:
    client, _ = llm()
    structured = [StructuredAmount("20260219002746", "CAPITAL_INCREASE", "fdpp_ocsa", 5, "KRW")]
    data = event_input(change(1), change(2, block=101), structured=structured)
    events = [text_event(1, title="유상증자 결정"), text_event(2, title="유상증자 납입")]

    scaled, _ = scale_events(llm()[0], data, events, {})

    assert [e.scale.source for e in scaled] == [AMOUNT_NONE, AMOUNT_NONE]
