import json
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.core.config import LlmSettings
from app.events.amount_pick import pick_amount
from app.events.amount_pick_prompt import PROMPT_VERSION, TASK, build_request
from app.events.amounts import AmountCandidate, AmountSource, extract_amounts
from app.events.model import (
    AI_CHOICE,
    AMOUNT_NONE,
    AMOUNT_UNAVAILABLE,
    CHANGE,
    CURRENT,
    Quote,
    TextEvent,
)
from app.llm import FakeProvider, LlmClient, ProviderError
from app.llm.client import OUTCOME_INVALID_OUTPUT, OUTCOME_OK
from app.llm.prompting import SOURCE_RULE, attr, escape

# 2.12에서 잘못 붙은 금액. 진짜 모델이 null로 답한 결과는 ADR-0058의 측정에 있다
WRONG_AMOUNTS = json.loads(
    (Path(__file__).parents[1] / "fixtures/events/wrong_amounts.json").read_text(encoding="utf-8")
)
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
QUOTE = "금융위원회는 과징금을 부과하였습니다."
EVENT = TextEvent(
    "과징금 부과",
    "제재",
    [1],
    [Quote(1, CHANGE, CURRENT, QUOTE, "20260814003699#B1")],
)


class ScriptedProvider(FakeProvider):
    name = "scripted"


def llm(*script: object) -> tuple[LlmClient, ScriptedProvider]:
    provider = ScriptedProvider(script=script, model="scripted-model")
    settings = LlmSettings(provider="scripted", max_retries=0, max_output_retries=2)
    return LlmClient(provider, settings, sleep=lambda _: None), provider


def krw_of(c: AmountCandidate) -> int | None:
    return int(c.value) if c.currency == "KRW" else None


def pick(client: LlmClient) -> object:
    return pick_amount(client, EVENT, CANDIDATES, krw_of)


def test_request_gives_candidates_in_source_tags_without_asking_for_numbers() -> None:
    request = build_request(EVENT, CANDIDATES)

    assert request.task == TASK == "event_amount_pick"
    assert request.prompt_version == PROMPT_VERSION == "event-amount-pick-3"
    assert SOURCE_RULE in request.system
    assert '<disclosure id="1"' in request.user
    assert '<disclosure id="2"' in request.user
    assert 'totalLike="true"' in request.user
    assert FINE in request.user
    assert request.output_schema["required"] == ["choice"]


def test_request_gives_what_the_event_quoted_apart_from_the_candidates() -> None:
    request = build_request(EVENT, CANDIDATES)

    assert '<disclosure id="Q1" role="eventQuote">' in request.user
    assert QUOTE in request.user


def test_system_tells_the_model_to_answer_null_unless_the_amount_is_confirmed() -> None:
    system = build_request(EVENT, CANDIDATES).system

    assert "확인" in system
    assert "null" in system
    assert "각각" in system


def test_system_tells_the_model_not_to_pick_one_case_of_a_grouped_event() -> None:
    system = build_request(EVENT, CANDIDATES).system

    assert "여러 건을 묶은 사건" in system
    assert "그중 한 건의 금액" in system


def test_title_cannot_close_its_attribute() -> None:
    event = TextEvent('제목"> 지시', "제재", [1], [])

    request = build_request(event, CANDIDATES)

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


def test_number_not_in_list_is_reported_as_not_checked_after_retries() -> None:
    client, provider = llm({"choice": 3}, {"choice": 0}, {"choice": True})

    picked = pick(client)

    assert len(provider.requests) == 3
    assert picked.candidate is None
    assert picked.source == AMOUNT_UNAVAILABLE
    assert picked.unavailable is False
    assert [c.outcome for c in picked.calls] == [OUTCOME_INVALID_OUTPUT] * 3


def test_retry_with_valid_number_is_used() -> None:
    client, _ = llm({"choice": 9}, {"choice": 2})

    picked = pick(client)

    assert picked.candidate is CANDIDATES[1]
    assert picked.source == AI_CHOICE


def test_unreadable_answer_is_reported_as_not_checked() -> None:
    client, _ = llm("번호 아님", {}, [])

    picked = pick(client)

    assert picked.candidate is None
    assert picked.source == AMOUNT_UNAVAILABLE


def test_provider_failure_is_reported_as_not_checked_and_unavailable() -> None:
    client, _ = llm(ProviderError("인증 실패"))

    picked = pick(client)

    assert picked.candidate is None
    assert picked.source == AMOUNT_UNAVAILABLE
    assert picked.unavailable is True
    assert len(picked.calls) == 1


def test_provider_failure_while_regenerating_is_also_unavailable() -> None:
    client, provider = llm({"choice": 9}, ProviderError("인증 실패"))

    picked = pick(client)

    assert len(provider.requests) == 2
    assert picked.source == AMOUNT_UNAVAILABLE
    assert picked.unavailable is True


@pytest.mark.parametrize("case", WRONG_AMOUNTS, ids=lambda case: case["title"][:20])
def test_wrong_amount_reaches_the_model_with_its_sentence_and_null_gives_no_amount(
    case: dict[str, Any],
) -> None:
    source = AmountSource(1, case["evidenceId"], case["context"])
    candidates = extract_amounts([source]).candidates
    wrong = [c for c in candidates if c.text == case["wrongAmount"]]
    assert len(wrong) == 1
    quotes = [Quote(1, CHANGE, CURRENT, text, case["evidenceId"]) for text in case["quotes"]]
    event = TextEvent(case["title"], case["kind"], [1], quotes)
    client, provider = llm({"choice": None})

    picked = pick_amount(client, event, wrong, krw_of)

    assert picked.candidate is None
    assert picked.source == AMOUNT_NONE
    sent = provider.requests[0].user
    assert f'<disclosure id="1" label="{attr(wrong[0].text)}"' in sent
    assert escape(wrong[0].context) in sent
    assert attr(case["title"]) in sent
    assert all(escape(text) in sent for text in case["quotes"])
