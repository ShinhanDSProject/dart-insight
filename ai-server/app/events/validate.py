"""주요 사건 검증(2.15, ADR-0050).

코드가 사건마다 확인한다.
- 제목과 사건 종류가 있고 칸 길이를 넘지 않는다.
- changeNos가 하나 이상이고 모두 후보 변경이다.
- 무엇이 바뀌었는지 보여 주는 인용(CHANGE)이 하나 이상 있다.
- 인용은 그 사건의 변경이고, 블록 번호가 있는 쪽의 글(모델에 넣은 글)의 부분 문자열이다
  (이어진 공백은 한 칸으로 맞춰 비교). 근거 ID는 모델이 아니라 코드가 만든다.
- 제목과 사건 종류의 사실이 그 사건의 변경 글에 있다(facts.py).
- 원인 표현(ADR-0015)은 인용에도 원인 표현이 있을 때만 쓴다.
- 제목과 사건 종류가 투자 권유성 표현 검사(app.compliance)를 통과한다.
  인용은 회사가 쓴 원문이라 검사하지 않는다.
돌려주는 인용은 이어진 공백을 한 칸으로 맞춘 글이다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.compliance import scan
from app.events.facts import fact_problem
from app.events.model import (
    CHANGE,
    MAX_KIND_CHARS,
    MAX_TITLE_CHARS,
    PURPOSES,
    SIDES,
    EventChange,
    EventInput,
    Quote,
    TextEvent,
)
from app.summary.causal import find as find_causal

_SPACES = re.compile(r"\s+")


@dataclass(frozen=True)
class Checked:
    """통과한 사건과, 통과하지 못한 사건마다 하나씩의 문제(LLM에 알려 줄 문장)."""

    events: list[TextEvent] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)


def _spaces(text: str) -> str:
    return _SPACES.sub(" ", text).strip()


def _as_written(text: str) -> str:
    """모델이 옮긴 글. 프롬프트에서 바꿔 넣은 &lt; 등을 되돌리고 공백을 맞춘다."""
    plain = text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return _spaces(plain)


def check(data: Any, event_input: EventInput) -> Checked:
    if not isinstance(data, dict) or not isinstance(data.get("events"), list):
        return Checked(problems=["events 배열이 있는 JSON 객체가 필요합니다."])
    changes = {c.change_no: c for c in event_input.candidates}
    events: list[TextEvent] = []
    problems: list[str] = []
    for no, entry in enumerate(data["events"], start=1):
        result = _event(entry, changes, event_input)
        if isinstance(result, str):
            problems.append(f"{no}번 사건: {result}")
        else:
            events.append(result)
    return Checked(events, problems)


def _event(entry: Any, changes: dict[int, EventChange], event_input: EventInput) -> TextEvent | str:
    if not isinstance(entry, dict):
        return "title·kind·changeNos·quotes가 있는 객체여야 합니다."
    title = _text(entry.get("title"))
    if not title or len(title) > MAX_TITLE_CHARS:
        return f"title은 1자 이상 {MAX_TITLE_CHARS}자 이하여야 합니다."
    kind = _text(entry.get("kind"))
    if not kind or len(kind) > MAX_KIND_CHARS:
        return f"kind는 1자 이상 {MAX_KIND_CHARS}자 이하여야 합니다."
    change_nos = _change_nos(entry.get("changeNos"), changes)
    if isinstance(change_nos, str):
        return change_nos
    quotes = _quotes(entry.get("quotes"), change_nos, changes, event_input)
    if isinstance(quotes, str):
        return quotes
    written = f"{title} {kind}"
    source = _source(change_nos, changes)
    problem = fact_problem(written, source) or _causal_problem(written, quotes)
    return problem or _advice_problem(written) or TextEvent(title, kind, change_nos, quotes)


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _change_nos(value: Any, changes: dict[int, EventChange]) -> list[int] | str:
    if not isinstance(value, list) or not value:
        return "changeNos에 변경 번호를 하나 이상 적어야 합니다."
    if not all(type(no) is int and no in changes for no in value):
        return "changeNos에 입력에 없는 변경 번호가 있습니다."
    return list(dict.fromkeys(value))


def _quotes(
    value: Any,
    change_nos: list[int],
    changes: dict[int, EventChange],
    event_input: EventInput,
) -> list[Quote] | str:
    if not isinstance(value, list):
        return "quotes는 배열이어야 합니다."
    quotes: list[Quote] = []
    for entry in value:
        quote = _quote(entry, change_nos, changes, event_input)
        if isinstance(quote, str):
            return quote
        quotes.append(quote)
    if not any(q.purpose == CHANGE for q in quotes):
        return "무엇이 바뀌었는지 보여 주는 인용(purpose CHANGE)이 하나 이상 있어야 합니다."
    return quotes


def _quote(
    entry: Any,
    change_nos: list[int],
    changes: dict[int, EventChange],
    event_input: EventInput,
) -> Quote | str:
    if not isinstance(entry, dict):
        return "인용은 changeNo·purpose·side·text가 있는 객체여야 합니다."
    change_no = entry.get("changeNo")
    purpose = entry.get("purpose")
    side = entry.get("side")
    if type(change_no) is not int or change_no not in change_nos:
        return f"인용의 changeNo({change_no})가 이 사건의 changeNos에 없습니다."
    if purpose not in PURPOSES:
        return f"purpose는 {', '.join(PURPOSES)} 중 하나여야 합니다."
    if side not in SIDES:
        return f"side는 {', '.join(SIDES)} 중 하나여야 합니다."
    change = changes[change_no]
    block_no = change.block_no(side)
    if block_no is None:
        return f"변경 {change_no}의 {side} 쪽은 원문 위치가 없어 인용할 수 없습니다."
    text = _as_written(_text(entry.get("text")))
    if not text:
        return "인용 글이 비어 있습니다."
    if text not in _spaces(change.text(side) or ""):
        return f"변경 {change_no}의 {side} 인용이 원문과 다릅니다. 원문을 그대로 옮기세요."
    evidence_id = f"{event_input.rcept_no(side)}#B{block_no}"
    return Quote(change_no, purpose, side, text, evidence_id)


def _source(change_nos: list[int], changes: dict[int, EventChange]) -> str:
    texts = [changes[no].text(side) for no in change_nos for side in SIDES]
    return " ".join(t for t in texts if t)


def _causal_problem(written: str, quotes: list[Quote]) -> str | None:
    claim = find_causal(written)
    if claim and not find_causal(" ".join(q.text for q in quotes)):
        return f"원인 표현('{claim}')은 인용이 원인을 직접 밝혔을 때만 씁니다."
    return None


def _advice_problem(written: str) -> str | None:
    findings = scan(written)
    if not findings:
        return None
    labels = ", ".join(dict.fromkeys(f.label for f in findings))
    return f"투자 권유로 읽힐 수 있는 표현이 있습니다({labels}). 일어난 일만 중립적으로 쓰세요."
