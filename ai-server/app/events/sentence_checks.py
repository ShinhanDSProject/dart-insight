"""사건 문장(공시의 의미, 신호 이유)이 함께 쓰는 검증과 호출(2.22·2.23, ADR-0060).

- 근거 ID는 그 사건에 묶인 변경의 블록이어야 한다.
- 금액·날짜·사건번호·회사 이름·건수·비율이 그 문장이 근거로 든 블록이나 코드 값에 있다(facts.py).
- 원인 표현은 근거 블록에도 원인 표현이 있을 때만 쓴다.
- 투자 권유성 표현 검사(app.compliance)를 통과한다.
결과가 달라지게 바꾸면 meaning_prompt.py·signal_reason_prompt.py의 PROMPT_VERSION을 올린다.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from app.compliance import scan
from app.events.facts import fact_problem
from app.events.meaning_prompt import MAX_SENTENCE_CHARS, Block
from app.events.model import (
    GENERATED,
    INVALID_OUTPUT,
    LLM_UNAVAILABLE,
    EventSentence,
    SentenceItem,
)
from app.llm import CallRecord, LlmClient, LlmOutputInvalid, LlmRequest, LlmUnavailable
from app.llm.client import OUTCOME_ERROR, OUTCOME_TRANSIENT_ERROR
from app.summary.causal import find as find_causal

# 실패 사유(INVALID_OUTPUT·LLM_UNAVAILABLE)와 호출 기록을 받아 그 칸의 실패 모양을 만든다
Failed = Callable[[str, list[CallRecord]], EventSentence]


@dataclass(frozen=True)
class Written:
    sentence: EventSentence
    calls: list[CallRecord] = field(default_factory=list)
    # LLM을 쓸 수 없다고 판명됨. 뒤 사건은 부르지 않는다
    unavailable: bool = False


def call_sentence(
    llm: LlmClient,
    request: LlmRequest,
    validate: Callable[[Any], tuple[SentenceItem, ...]],
    failed: Failed,
) -> Written:
    """부르고 검증한다. 다시 만들어도 실패하거나 LLM을 쓸 수 없으면 failed의 모양으로 남긴다."""
    try:
        generated = llm.generate(request, validate)
    except LlmOutputInvalid as e:
        # 다시 만들다 호출이 실패해도 이 예외로 온다. 그때는 LLM을 쓸 수 없는 것이다
        down = bool(e.calls) and e.calls[-1].outcome in (OUTCOME_ERROR, OUTCOME_TRANSIENT_ERROR)
        reason = LLM_UNAVAILABLE if down else INVALID_OUTPUT
        return Written(failed(reason, e.calls), e.calls, unavailable=down)
    except LlmUnavailable as e:
        return Written(failed(LLM_UNAVAILABLE, e.calls), e.calls, unavailable=True)
    sentence = EventSentence(
        GENERATED,
        generated.value,
        model=generated.model,
        prompt_version=generated.prompt_version,
        generated_at=generated.generated_at,
    )
    return Written(sentence, generated.calls)


def last_call(calls: list[CallRecord]) -> dict[str, str | None]:
    """마지막 호출의 모델·프롬프트 버전·시각. 부르지 않았으면 모두 None."""
    last = calls[-1] if calls else None
    return {
        "model": last.model if last else None,
        "prompt_version": last.prompt_version if last else None,
        "generated_at": last.called_at if last else None,
    }


def entries_of(output: Any) -> list[Any] | None:
    if not isinstance(output, dict) or not isinstance(output.get("items"), list):
        return None
    return output["items"]


def text_of(entry: dict[str, Any]) -> str | None:
    """1자 이상 MAX_SENTENCE_CHARS자 이하의 글. 아니면 None."""
    value = entry.get("text")
    text = value.strip() if isinstance(value, str) else ""
    return text if text and len(text) <= MAX_SENTENCE_CHARS else None


def cited_of(entry: dict[str, Any], by_id: dict[str, Block]) -> list[Block] | None:
    """근거로 든 블록(겹치면 하나로). 하나도 없거나 사건 밖의 ID가 있으면 None."""
    ids = entry.get("evidenceIds")
    if not isinstance(ids, list) or not ids:
        return None
    if not all(isinstance(i, str) and i in by_id for i in ids):
        return None
    return [by_id[i] for i in dict.fromkeys(ids)]


def text_problem(text: str, cited: list[Block], values: str) -> str | None:
    """문장의 사실·원인 표현·투자 권유성 표현. 문제가 없으면 None."""
    source = " ".join([*(b.text for b in cited), values])
    return fact_problem(text, source) or _causal_problem(text, cited) or _advice_problem(text)


TEXT_PROBLEM = f"text는 1자 이상 {MAX_SENTENCE_CHARS}자 이하여야 합니다."
EVIDENCE_PROBLEM = "evidenceIds에는 <disclosure>의 id만 하나 이상 적어야 합니다."


def _causal_problem(text: str, cited: list[Block]) -> str | None:
    claim = find_causal(text)
    if claim and not find_causal(" ".join(b.text for b in cited)):
        return f"원인 표현('{claim}')은 원문이 원인을 직접 밝혔을 때만 씁니다."
    return None


def _advice_problem(text: str) -> str | None:
    findings = scan(text)
    if not findings:
        return None
    labels = ", ".join(dict.fromkeys(f.label for f in findings))
    return f"투자 권유로 읽힐 수 있는 표현이 있습니다({labels}). 공시에 적힌 사실만 쓰세요."
