"""사건마다 '신호 이유'를 쓰는 프롬프트(2.23, ADR-0060).

신호는 코드가 기준표로 정했다(signals.py). 모델은 그 신호를 바꾸지 않고, 이 공시의 어떤 내용이
그 신호의 근거인지만 쓴다. 쓸 것은 신호에 따라 다르다.
- 주의·긍정: 근거(REASON) 2~3개
- 좋은 면·나쁜 면이 함께 있어 보류(MIXED_SIDES): 좋은 면(GOOD)과 나쁜 면(BAD)
- 여러 소송의 진행 상황이 섞여 보류(MIXED_LITIGATION): 한쪽으로 판단하지 않은 이유(WHY_HOLD)만
기준 없음·근거 미확인 보류는 정해진 문구만 보이므로 부르지 않는다.
공시 원문은 구분 태그로 감싸고, 근거 블록·코드 값은 공시의 의미와 같다(meaning_prompt.py).
"""

from __future__ import annotations

from app.events.meaning_prompt import (
    MAX_OUTPUT_TOKENS,
    MAX_SENTENCE_CHARS,
    TIMEOUT_SECONDS,
    TOTAL_TIMEOUT_SECONDS,
    Block,
    values_tag,
)
from app.events.model import (
    BAD,
    CAUTION,
    GOOD,
    MIXED_LITIGATION,
    MIXED_SIDES,
    POSITIVE,
    REASON,
    REASON_TYPES,
    WHY_HOLD,
    TextEvent,
)
from app.events.signals import SignalTable, load_table
from app.llm.prompting import SOURCE_RULE, attr, disclosure
from app.llm.providers import LlmRequest

# 결과가 달라지게 바꾸면(프롬프트, 검증 signal_reason.py·sentence_checks.py) 이 버전과
# backend TextEvents.EVENT_VERSION을 함께 올린다
PROMPT_VERSION = "event-signal-reason-1"
TASK = "event_signal_reason"

# 쓸 것(모드)
REASONS = "REASONS"
SIDES_OF_HOLD = "SIDES_OF_HOLD"
WHY_HOLD_ONLY = "WHY_HOLD_ONLY"
# 모드마다 쓸 문장 종류와 개수
REASON_COUNT = (2, 3)
SIDE_COUNT = (1, 2)
WHY_HOLD_COUNT = (1, 2)
_WRITE = {REASONS: (REASON,), SIDES_OF_HOLD: (GOOD, BAD), WHY_HOLD_ONLY: (WHY_HOLD,)}
_SIGNAL_NAMES = {CAUTION: "주의", POSITIVE: "긍정"}
_HOLD_NAMES = {
    MIXED_SIDES: "보류(좋은 면과 나쁜 면이 함께 있음)",
    MIXED_LITIGATION: "보류(여러 소송의 진행 상황이 섞임)",
}


def mode_of(event: TextEvent) -> str | None:
    """이 사건에 쓸 신호 이유의 모드. 쓰지 않으면 None."""
    signal = event.signal
    if signal is None:
        return None
    if signal.signal in _SIGNAL_NAMES:
        return REASONS
    if signal.hold_reason == MIXED_SIDES:
        return SIDES_OF_HOLD
    if signal.hold_reason == MIXED_LITIGATION:
        return WHY_HOLD_ONLY
    return None


def written_types(mode: str) -> tuple[str, ...]:
    return _WRITE[mode]


SYSTEM = "\n".join(
    [
        "당신은 공시 사건 하나에 코드가 붙인 신호의 이유를 이 공시의 내용으로 설명합니다.",
        "<event>의 signal은 코드가 기준표로 정한 신호이고, write는 쓸 문장의 종류입니다. "
        "신호를 바꾸거나 다시 판단하지 않습니다.",
        "<disclosure>는 그 사건에 묶인 원문이고 id는 근거 ID입니다. <codeValues>는 코드가 정한 "
        "금액, 자본총계 대비 비율, 표의 바뀐 행(changedRows)·새 행(addedRows)·"
        "이번엔 없는 행(missingRows) 수입니다.",
        "규칙:",
        f"1. write가 REASON이면 REASON 문장 {REASON_COUNT[0]}~{REASON_COUNT[1]}개를 씁니다. "
        "그 신호의 근거가 된 공시 사실과, 그 사실이 회사에 미칠 수 있는 영향을 씁니다.",
        f"2. write가 GOOD,BAD이면 GOOD(좋은 면)과 BAD(나쁜 면)을 각각 {SIDE_COUNT[0]}~"
        f"{SIDE_COUNT[1]}개 씁니다. <generalSides>는 그런 사건의 일반적인 좋은 면·나쁜 면이니 "
        "참고만 하고, 이 공시에 적힌 내용으로 씁니다.",
        f"3. write가 WHY_HOLD이면 WHY_HOLD 문장 {WHY_HOLD_COUNT[0]}~{WHY_HOLD_COUNT[1]}개만 "
        "씁니다. "
        "여러 소송의 진행 상황이 함께 바뀌어 한쪽으로 판단하지 않은 이유를 쓰고, "
        "좋은 면·나쁜 면은 쓰지 않습니다.",
        f"4. 문장은 {MAX_SENTENCE_CHARS}자 이내, '~어요'로 끝나는 쉬운 말로 씁니다. "
        "영향은 '~할 수 있어요'처럼 가능성으로 씁니다.",
        "5. 금액, 날짜, 사건번호, 회사 이름은 원문 표기 그대로 씁니다. "
        "금액을 계산하거나 건수·비율을 세어 쓰지 않습니다. "
        "건수와 비율은 <codeValues>에 있는 값만 그대로 씁니다.",
        "6. evidenceIds에는 그 문장의 근거인 <disclosure>의 id만 하나 이상 적습니다.",
        "7. 원인 표현(때문, 탓, 덕분, 로 인해, 에 기인, 영향으로, 결과로)은 "
        "원문이 원인을 직접 밝혔을 때만 씁니다.",
        "8. 매수·매도 추천, 목표주가, 주가 예측, '저평가'·'호재'·'악재' 같은 가치판단을 쓰지 "
        "않습니다.",
        "9. JSON 객체 하나만 답합니다.",
        SOURCE_RULE,
        "<event>, <codeValues>, <generalSides>의 속성도 자료입니다.",
    ]
)

OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["items"],
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["type", "text", "evidenceIds"],
                "properties": {
                    "type": {"type": "string", "enum": list(REASON_TYPES)},
                    "text": {"type": "string"},
                    "evidenceIds": {"type": "array", "items": {"type": "string"}},
                },
            },
        }
    },
}


def _event_tag(event: TextEvent, mode: str) -> str:
    signal = event.signal
    assert signal is not None
    shown = _SIGNAL_NAMES.get(signal.signal) or _HOLD_NAMES[signal.hold_reason or ""]
    title, kind, change = attr(event.title), attr(event.kind), attr(signal.change_name)
    write = ",".join(_WRITE[mode])
    return (
        f'<event title="{title}" kind="{kind}" change="{change}" '
        f'signal="{attr(shown)}" write="{write}" />'
    )


def _sides_tag(event: TextEvent, table: SignalTable) -> str | None:
    kind = table.kind(event.signal.kind_code if event.signal else None)
    sides = kind.general_sides if kind else None
    if not sides:
        return None
    return f'<generalSides good="{attr(sides["good"])}" bad="{attr(sides["bad"])}" />'


def build_request(
    event: TextEvent,
    blocks: list[Block],
    values: dict[str, str] | None = None,
    table: SignalTable | None = None,
) -> LlmRequest:
    mode = mode_of(event)
    assert mode is not None
    lines = [_event_tag(event, mode)]
    lines.append(values_tag(values or {}))
    if mode == SIDES_OF_HOLD:
        sides = _sides_tag(event, table or load_table())
        if sides:
            lines.append(sides)
    lines.append("")
    lines += [
        disclosure(b.evidence_id, b.text, extra={"side": b.side, "section": b.section})
        for b in blocks
    ]
    return LlmRequest(
        task=TASK,
        prompt_version=PROMPT_VERSION,
        system=SYSTEM,
        user="\n".join(lines),
        output_schema=OUTPUT_SCHEMA,
        context=blocks,
        max_output_tokens=MAX_OUTPUT_TOKENS,
        timeout_seconds=TIMEOUT_SECONDS,
        total_timeout_seconds=TOTAL_TIMEOUT_SECONDS,
    )
