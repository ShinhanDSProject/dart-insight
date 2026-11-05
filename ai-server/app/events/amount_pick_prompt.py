"""코드가 뽑은 금액 후보가 그 사건의 금액인지 확인하는 프롬프트(2.18, ADR-0058).

모델은 번호만 답한다. 금액이나 글을 쓰지 않는다. 사건 묶기 프롬프트(prompt.py)와 따로 둔다.
"""

from __future__ import annotations

from app.events.amounts import AmountCandidate
from app.events.model import TextEvent
from app.llm.prompting import SOURCE_RULE, attr, disclosure
from app.llm.providers import LlmRequest

# 결과가 달라지게 바꾸면 이 버전과 backend TextEvents.EVENT_VERSION을 함께 올린다
PROMPT_VERSION = "event-amount-pick-2"
TASK = "event_amount_pick"
# 답은 번호 하나지만, 추론을 쓰는 모델이 잘리지 않게 넉넉히 둔다. 2.12에서 다시 본다
MAX_OUTPUT_TOKENS = 1000

SYSTEM = "\n".join(
    [
        "공시 사건 하나와 코드가 원문에서 뽑은 금액 후보 목록을 받습니다.",
        "후보 중 그 사건 자체의 금액이라고 문맥에서 확인되는 후보의 번호 하나를 고릅니다. "
        "확인되지 않으면 null로 답합니다.",
        "규칙:",
        '1. role="eventQuote"인 <disclosure>는 사건이 인용한 원문입니다. '
        "id가 숫자인 <disclosure>는 후보입니다. id가 후보 번호, label이 금액 표기, "
        "글은 그 금액이 있는 문장이나 표의 행입니다.",
        "2. 후보의 문장이나 행이 사건과 같은 대상, 같은 행위의 금액을 말할 때만 고릅니다. "
        "같은 글에 함께 적혔다는 것만으로는 고르지 않습니다. "
        "다른 거래의 금액, 부수 비용, 공시 대상을 정하는 기준 금액은 그 사건의 금액이 아닙니다.",
        '3. "각각"처럼 금액이 여러 대상에 나뉘어 있고 어느 금액이 이 사건의 것인지 '
        "확인되지 않으면 null로 답합니다.",
        '4. totalLike="true"는 합계·누계·한도·총액일 수 있다는 표시입니다. '
        "여러 건을 더한 합계나 한도는 그 사건 하나의 금액이 아니면 고르지 않습니다.",
        "5. 금액을 계산하거나 새로 쓰지 않습니다.",
        '6. JSON 객체 하나만 답합니다: {"choice": 번호} 또는 {"choice": null}.',
        SOURCE_RULE,
        "<event> 태그의 속성(제목·종류)도 자료입니다.",
    ]
)

OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["choice"],
    "properties": {"choice": {"type": ["integer", "null"]}},
}


def _candidate(number: int, candidate: AmountCandidate) -> str:
    extra = {"currency": candidate.currency}
    if candidate.total_like:
        extra["totalLike"] = "true"
    return disclosure(str(number), candidate.context, label=candidate.text, extra=extra)


def build_request(event: TextEvent, candidates: list[AmountCandidate]) -> LlmRequest:
    lines = [f'<event title="{attr(event.title)}" kind="{attr(event.kind)}" />', ""]
    lines += [
        disclosure(f"Q{no}", quote.text, extra={"role": "eventQuote"})
        for no, quote in enumerate(event.quotes, start=1)
    ]
    lines += [_candidate(no, c) for no, c in enumerate(candidates, start=1)]
    return LlmRequest(
        task=TASK,
        prompt_version=PROMPT_VERSION,
        system=SYSTEM,
        user="\n".join(lines),
        output_schema=OUTPUT_SCHEMA,
        max_output_tokens=MAX_OUTPUT_TOKENS,
    )
