"""코드가 뽑은 금액 후보 중 사건의 규모를 고르는 프롬프트(2.16, ADR-0053).

모델은 번호만 답한다. 금액이나 글을 쓰지 않는다. 사건 묶기 프롬프트(prompt.py)와 따로 둔다.
"""

from __future__ import annotations

from app.events.amounts import AmountCandidate
from app.llm.prompting import SOURCE_RULE, attr, disclosure
from app.llm.providers import LlmRequest

# 결과가 달라지게 바꾸면 이 버전과 backend TextEvents.EVENT_VERSION을 함께 올린다
PROMPT_VERSION = "event-amount-pick-1"
TASK = "event_amount_pick"
# 답은 번호 하나지만, 추론을 쓰는 모델이 잘리지 않게 넉넉히 둔다. 2.12에서 다시 본다
MAX_OUTPUT_TOKENS = 1000

SYSTEM = "\n".join(
    [
        "공시 사건 하나와 코드가 원문에서 뽑은 금액 후보 목록을 받습니다.",
        "그 사건의 규모를 가장 잘 나타내는 후보의 번호 하나를 고릅니다.",
        "규칙:",
        "1. <disclosure>의 id가 후보 번호, label이 금액 표기, 글은 금액의 앞뒤 문맥입니다.",
        '2. totalLike="true"는 합계·누계·한도·총액일 수 있다는 표시입니다. '
        "여러 건을 더한 합계나 한도는 그 사건 하나의 규모가 아니면 고르지 않습니다.",
        "3. 사건과 관계없는 금액만 있으면 null로 답합니다. 금액을 계산하거나 새로 쓰지 않습니다.",
        '4. JSON 객체 하나만 답합니다: {"choice": 번호} 또는 {"choice": null}.',
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


def build_request(title: str, kind: str, candidates: list[AmountCandidate]) -> LlmRequest:
    lines = [f'<event title="{attr(title)}" kind="{attr(kind)}" />', ""]
    lines += [_candidate(no, c) for no, c in enumerate(candidates, start=1)]
    return LlmRequest(
        task=TASK,
        prompt_version=PROMPT_VERSION,
        system=SYSTEM,
        user="\n".join(lines),
        output_schema=OUTPUT_SCHEMA,
        max_output_tokens=MAX_OUTPUT_TOKENS,
    )
