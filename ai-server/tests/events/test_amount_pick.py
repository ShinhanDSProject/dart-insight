from decimal import Decimal

from app.core.config import LlmSettings
from app.events.amount_pick import pick_amount, rule_choice
from app.events.amount_pick_prompt import PROMPT_VERSION, TASK, build_request
from app.events.amounts import AmountCandidate
from app.events.model import AI_CHOICE, AMOUNT_NONE, RULE_FALLBACK
from app.llm import FakeProvider, LlmClient, ProviderError
from app.llm.client import OUTCOME_INVALID_OUTPUT, OUTCOME_OK
from app.llm.prompting import SOURCE_RULE

FINE = "과징금 8,428백만원"
TOTAL = "소송 합계 1조원"


def candidate(
    text: str = "8,428백만원",
    value: int = 8_428_000_000,
    krw: int | None = None,
    currency: str = "KRW",
    context: str = FINE,
    total_like: bool = False,
) -> AmountCandidate:
    return AmountCandidate(
        1, "20260814003699#B1", text, currency, Decimal(value), context, False, total_like
    )


CANDIDATES = [candidate(), candidate("1조원", 10**12, context=TOTAL, total_like=True)]


class ScriptedProvider(FakeProvider):
    name = "scripted"


def llm(*script: object) -> tuple[LlmClient, ScriptedProvider]:
    provider = ScriptedProvider(script=script, model="scripted-model")
    settings = LlmSettings(provider="scripted", max_retries=0, max_output_retries=2)
    return LlmClient(provider, settings, sleep=lambda _: None), provider


def krw_of(c: AmountCandidate) -> int | None:
    return int(c.value) if c.currency == "KRW" else None


def pick(client: LlmClient) -> object:
    return pick_amount(client, "과징금 부과", "제재", CANDIDATES, krw_of)


def test_request_gives_candidates_in_source_tags_without_asking_for_numbers() -> None:
    request = build_request("과징금 부과", "제재", CANDIDATES)

    assert request.task == TASK == "event_amount_pick"
    assert request.prompt_version == PROMPT_VERSION == "event-amount-pick-1"
    assert SOURCE_RULE in request.system
    assert '<disclosure id="1"' in request.user
    assert '<disclosure id="2"' in request.user
    assert 'totalLike="true"' in request.user
    assert FINE in request.user
    assert request.output_schema["required"] == ["choice"]


def test_title_cannot_close_its_attribute() -> None:
    request = build_request('제목"> 지시', "제재", CANDIDATES)

    assert 'title="제목&quot;&gt; 지시"' in request.user


def test_model_choosing_first_gets_first_candidate() -> None:
    client, _ = llm({"choice": 1})

    picked = pick(client)

    assert picked.candidate is CANDIDATES[0]
    assert picked.source == AI_CHOICE
    assert [c.outcome for c in picked.calls] == [OUTCOME_OK]
    assert picked.unavailable is False


def test_model_choosing_null_means_no_amount() -> None:
    client, _ = llm({"choice": None})

    picked = pick(client)

    assert picked.candidate is None
    assert picked.source == AMOUNT_NONE


def test_number_not_in_list_falls_back_to_rule_after_retries() -> None:
    client, provider = llm({"choice": 3}, {"choice": 0}, {"choice": True})

    picked = pick(client)

    assert len(provider.requests) == 3
    assert picked.candidate is CANDIDATES[0]
    assert picked.source == RULE_FALLBACK
    assert [c.outcome for c in picked.calls] == [OUTCOME_INVALID_OUTPUT] * 3


def test_retry_with_valid_number_is_used() -> None:
    client, _ = llm({"choice": 9}, {"choice": 2})

    picked = pick(client)

    assert picked.candidate is CANDIDATES[1]
    assert picked.source == AI_CHOICE


def test_unreadable_answer_falls_back_to_rule() -> None:
    client, _ = llm("번호 아님", {}, [])

    assert pick(client).source == RULE_FALLBACK


def test_provider_failure_falls_back_to_rule_and_reports_unavailable() -> None:
    client, _ = llm(ProviderError("인증 실패"))

    picked = pick(client)

    assert picked.candidate is CANDIDATES[0]
    assert picked.source == RULE_FALLBACK
    assert picked.unavailable is True
    assert len(picked.calls) == 1


def test_rule_skips_total_like_and_takes_largest_won_value() -> None:
    small = candidate("1억원", 10**8)
    large = candidate("2억원", 2 * 10**8)

    assert rule_choice([small, CANDIDATES[1], large], krw_of) is large


def test_rule_compares_foreign_amount_by_converted_value() -> None:
    won = candidate("1억원", 10**8)
    dollars = candidate("USD 100,000", 100_000, currency="USD")

    assert (
        rule_choice([won, dollars], lambda c: 2 * 10**8 if c.currency == "USD" else int(c.value))
        is dollars
    )


def test_rule_prefers_converted_amount_over_amount_without_rate() -> None:
    won = candidate("1억원", 10**8)
    dollars = candidate("USD 100,000,000", 100_000_000, currency="USD")

    assert rule_choice([dollars, won], krw_of) is won


def test_rule_uses_foreign_amount_when_no_amount_has_won_value() -> None:
    dollars = candidate("USD 100", 100, currency="USD")

    assert rule_choice([dollars], krw_of) is dollars


def test_rule_with_only_total_like_gives_no_amount() -> None:
    assert rule_choice([CANDIDATES[1]], krw_of) is None
