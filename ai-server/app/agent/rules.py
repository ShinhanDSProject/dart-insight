"""정해진 요청(#631, docs/api-spec.md 3절 POST /internal/agent-steps '정해진 요청').

이동·저장 확인만 하는 요청은 LLM 없이 정해진 안내와 액션 하나로 답한다. 메시지 전체가 정해진 꼴일
때만 쓰고, 꼴에 맞지 않거나 값을 하나로 정하지 못하면 None을 돌려 LLM이 고르게 둔다(ADR-0045
route_intent의 분기). 메시지는 공백을 모두 빼고 맞춘다.
"""

from __future__ import annotations

import re
from typing import Any

from app.agent.model import ANSWERED, FinalAnswer, StepInput, ToolCall
from app.agent.validate import schema_problem

# 탭 이름(공백 뺀 꼴) → 화면 탭. 탭 이름이 목차 제목보다 먼저다('원문 보여줘'는 원문 탭)
TABS: dict[str, str] = {
    "요약": "summary",
    "재무수치": "financial",
    "재무": "financial",
    "문장변화": "text",
    "원문": "source",
}
TAB_LABELS = {"summary": "요약", "financial": "재무 수치", "text": "문장 변화", "source": "원문"}
OUTLINE_TOOL = "get_document_outline"
# 이 말이 든 요청은 목차 이름이 아니라 변경 찾기다('소송 관련 변경 보여줘').
# 목차를 받지 않고 LLM에 둔다
NOT_SECTION_WORDS = ("관련", "변경", "변화")
CURRENT = "current"
TEXT_CHANGE = "TEXT_CHANGE"
FINANCIAL_CHANGE = "FINANCIAL_CHANGE"

OPEN_TAB_ANSWER = "아래 버튼을 누르면 {} 탭을 열어요."
OPEN_SECTION_ANSWER = "아래 버튼을 누르면 원문의 '{}' 항목을 열어요."
FAVORITE_ANSWER = "아래 버튼을 누르면 관심 기업에 추가해요."
NOTE_ANSWER = "아래 버튼을 누르면 노트에 담아요."

_TRAILING = re.compile(r"[.?!。]+$")
_OPEN = re.compile(r"^(?P<name>.+?)(?P<kind>탭|항목|목차)?(?P<verb>열어|보여)(?:줘|주세요|줄래)$")
_FAVORITE = re.compile(
    r"^(?:이기업|이회사)?관심기업(?:에|으로)?(?:추가해|등록해|넣어)(?:줘|주세요)$"
)
_NOTE = re.compile(r"^(?:이거|이것|이변경|이계정|이항목)?노트에(?:담아|저장해|넣어)(?:줘|주세요)$")
# backend ToolTexts.outline의 줄 꼴: [항목 {번호}] {제목} — 하위: [항목 {번호}] {제목} …
_OUTLINE_ITEM = re.compile(r"\[항목 (\d+)\] (.+?)(?= — 하위:| \[항목 |$)")
# 목차 제목 앞 번호: 'II.', '1.', '가.', '(1)'
_TITLE_NUMBER = re.compile(r"^(?:[IVXⅠ-Ⅻ]+\.|\d+\.|[가-하]\.|\(\d+\))\s*")


def match_rule(step: StepInput) -> FinalAnswer | ToolCall | None:
    """정해진 요청이면 답(FINAL) 또는 LLM 없이 부를 Tool(목차 받기), 아니면 None."""
    text = _compact(step.message)
    if _FAVORITE.match(text):
        return _final(step, FAVORITE_ANSWER, {"type": "CONFIRM_FAVORITE"})
    if _NOTE.match(text):
        note = _selected_change(step.context)
        return (
            None
            if note is None
            else _final(step, NOTE_ANSWER, {"type": "CONFIRM_SAVE_NOTE", "note": note})
        )
    opened = _OPEN.match(text)
    if opened is None:
        return None
    name = opened.group("name")
    tab = TABS.get(name)
    if tab is not None:
        answer = OPEN_TAB_ANSWER.format(TAB_LABELS[tab])
        return _final(step, answer, {"type": "OPEN_TAB", "tab": tab})
    # 목차 이름은 '열어줘'나 '항목·목차 보여줘'일 때만 본다.
    # '최대주주 보여줘' 같은 정보 조회는 목차를 받지 않는다
    if opened.group("verb") == "보여" and opened.group("kind") not in ("항목", "목차"):
        return None
    if any(word in name for word in NOT_SECTION_WORDS):
        return None
    return _open_section(step, name)


def _open_section(step: StepInput, name: str) -> FinalAnswer | ToolCall | None:
    """목차는 먼저 LLM 없이 받아 오고, 받은 뒤 제목이 하나와만 같으면 그 항목을 연다."""
    outline = next(
        (
            r
            for r in step.tool_results
            if r.name == OUTLINE_TOOL and r.arguments.get("side") == CURRENT
        ),
        None,
    )
    if outline is None:
        tool = step.tool(OUTLINE_TOOL)
        arguments = {"side": CURRENT}
        if tool is None or step.remaining_steps <= 0 or schema_problem(arguments, tool.parameters):
            return None
        return ToolCall(f"c{len(step.tool_results) + 1}", OUTLINE_TOOL, arguments)
    # 잘린 목차에서는 같은 제목이 하나만 보일 수 있어 하나뿐이라고 정하지 않는다
    if not outline.ok or outline.truncated:
        return None
    matches = [
        (int(no), title.strip())
        for item in outline.items
        for no, title in _OUTLINE_ITEM.findall(item.text)
        if _compact(_TITLE_NUMBER.sub("", title.strip())) == name
    ]
    if len(matches) != 1:
        return None
    section_no, title = matches[0]
    shown = _TITLE_NUMBER.sub("", title)
    return _final(
        step,
        OPEN_SECTION_ANSWER.format(shown),
        {"type": "OPEN_DOCUMENT", "side": CURRENT, "sectionNo": section_no},
    )


def _selected_change(context: dict[str, Any]) -> dict[str, Any] | None:
    """화면에서 고른 변경(노트에 담을 대상).

    지금 탭의 변경을 고르고, 탭으로 정하지 못하면 하나뿐일 때만 쓴다. 둘 다 있는데 어느 쪽인지
    모르면 None(LLM이 정함). 다른 변경을 담지 않게 한다.
    """
    chosen = {
        TEXT_CHANGE: _positive(context.get("textChangeId")),
        FINANCIAL_CHANGE: _positive(context.get("financialChangeId")),
    }
    by_tab = {"text": TEXT_CHANGE, "financial": FINANCIAL_CHANGE}.get(context.get("tab"))
    if by_tab is not None and chosen[by_tab] is not None:
        return {"kind": by_tab, "changeId": chosen[by_tab]}
    present = [(kind, change_id) for kind, change_id in chosen.items() if change_id is not None]
    if len(present) != 1:
        return None
    kind, change_id = present[0]
    return {"kind": kind, "changeId": change_id}


def _positive(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None


def _final(step: StepInput, answer: str, action: dict[str, Any]) -> FinalAnswer | None:
    """받은 액션 목록에 그 액션이 있고 값이 그 액션 형식에 맞을 때만 답한다."""
    spec = step.action(action["type"])
    if spec is None:
        return None
    fields = {k: v for k, v in action.items() if k != "type"}
    if schema_problem(fields, spec.parameters):
        return None
    return FinalAnswer(ANSWERED, answer=answer, actions=[action])


def _compact(message: str) -> str:
    return _TRAILING.sub("", re.sub(r"\s+", "", message))
