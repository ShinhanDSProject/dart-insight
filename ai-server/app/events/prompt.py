"""문장 변경을 주요 사건으로 묶는 프롬프트(2.15, ADR-0050).

공시 원문은 지시가 아니라 자료이므로 구분 태그로 감싼다(app.llm.prompting).
"""

from __future__ import annotations

from app.events.model import CURRENT, MAX_KIND_CHARS, PREVIOUS, PURPOSES, SIDES, EventChange
from app.llm.prompting import SOURCE_RULE, disclosure
from app.llm.providers import LlmRequest

# 결과가 달라지게 바꾸면(프롬프트, 검증 validate.py·facts.py) 이 버전과
# backend TextEvents.EVENT_VERSION을 함께 올린다
PROMPT_VERSION = "text-event-1"
TASK = "text_event"
# 2.12에서 잰 값의 약 1.6~1.7배다(출력 최대 18,610, 호출 최대 148초, ADR-0057)
MAX_OUTPUT_TOKENS = 32000
TIMEOUT_SECONDS = 240.0
TOTAL_TIMEOUT_SECONDS = 480.0

SYSTEM = "\n".join(
    [
        "당신은 같은 기업의 공시 보고서 두 개 사이에서 바뀐 부분을 사건으로 묶습니다.",
        "<disclosure>의 id는 변경 번호이고, side는 그 글이 이전 보고서(PREVIOUS)와 "
        "이번 보고서(CURRENT) 중 어디에 있는지입니다.",
        "규칙:",
        "1. 사건은 공시에서 실제로 일어난 일 하나입니다(예: 소송 제기, 인수, 유상증자, 제재). "
        "기간만 바뀐 표기, 해마다 되풀이되는 숫자 갱신은 사건으로 만들지 않습니다.",
        "2. changeNos에는 입력에 있는 변경 번호만 적습니다. "
        "한 변경이 두 사건에 관련되면 양쪽에 적어도 됩니다.",
        "3. title은 무슨 일이 일어났는지 60자 이내로 적습니다. 공시에 없는 내용을 더하지 않습니다. "
        "금액, 날짜, 사건번호, 회사 이름은 원문 표기 그대로 쓰고, "
        "금액을 계산하거나 건수·비율을 세어 쓰지 않습니다.",
        f"4. kind는 사건 종류의 짧은 이름입니다({MAX_KIND_CHARS}자 이내. 예: 소송, 제재, 인수).",
        "5. quotes의 text는 해당 변경의 원문을 한 글자도 바꾸지 않고 그대로 옮깁니다. "
        "quotes의 changeNo는 그 사건의 changeNos에 있어야 합니다. "
        'quotable="false"인 글은 인용하지 않습니다.',
        "6. 사건마다 무엇이 바뀌었는지 보여 주는 인용(purpose CHANGE)을 하나 이상 넣습니다. "
        "이전과 이번 글이 모두 있으면 양쪽을 인용합니다.",
        "7. 공시가 이유를 직접 밝혔으면 그 문장을 purpose REASON으로 인용합니다. "
        "밝히지 않았으면 넣지 않고, 이유를 짐작해 쓰지 않습니다.",
        "8. 원인 표현(때문, 탓, 덕분, 로 인해, 에 기인, 영향으로, 결과로)은 "
        "인용이 원인을 직접 밝혔을 때만 title에 씁니다.",
        "9. 매수·매도 추천, 목표주가, 주가 예측, 좋고 나쁨의 판단을 쓰지 않습니다.",
        '10. 사건이 없으면 {"events": []}로 답합니다. JSON 객체 하나만 답합니다.',
        SOURCE_RULE,
    ]
)

OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["events"],
    "properties": {
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["title", "kind", "changeNos", "quotes"],
                "properties": {
                    "title": {"type": "string"},
                    "kind": {"type": "string"},
                    "changeNos": {"type": "array", "items": {"type": "integer"}},
                    "quotes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["changeNo", "purpose", "side", "text"],
                            "properties": {
                                "changeNo": {"type": "integer"},
                                "purpose": {"type": "string", "enum": list(PURPOSES)},
                                "side": {"type": "string", "enum": list(SIDES)},
                                "text": {"type": "string"},
                            },
                        },
                    },
                },
            },
        }
    },
}


def _side(change: EventChange, side: str) -> str | None:
    text = change.text(side)
    if text is None:
        return None
    extra = {"side": side, "type": change.attrs.change_type, "section": change.attrs.section_path}
    if change.block_no(side) is None:
        extra["quotable"] = "false"
    return disclosure(str(change.change_no), text, extra=extra)


def build_request(candidates: list[EventChange]) -> LlmRequest:
    parts = [_side(change, side) for change in candidates for side in (PREVIOUS, CURRENT)]
    return LlmRequest(
        task=TASK,
        prompt_version=PROMPT_VERSION,
        system=SYSTEM,
        user="\n".join(["아래 변경을 사건으로 묶으세요.", *[p for p in parts if p]]),
        output_schema=OUTPUT_SCHEMA,
        max_output_tokens=MAX_OUTPUT_TOKENS,
        timeout_seconds=TIMEOUT_SECONDS,
        total_timeout_seconds=TOTAL_TIMEOUT_SECONDS,
    )
