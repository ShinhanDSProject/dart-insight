from typing import Any

from app.agent.model import (
    ANSWERED,
    FINAL,
    TOOL_CALLS,
    ActionSpec,
    FinalAnswer,
    ResultItem,
    StepInput,
    ToolCall,
    ToolResult,
    ToolSpec,
)
from app.agent.prompt import TASK_PLAN
from app.agent.rules import match_rule
from app.agent.service import run_step
from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient


def obj(properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


# backend AgentActions·AgentTools와 같은 꼴
OUTLINE = ToolSpec(
    "get_document_outline",
    "원문 목차",
    obj({"side": {"enum": ["previous", "current"]}}, ["side"]),
)
ACTIONS = [
    ActionSpec(
        "OPEN_TAB", obj({"tab": {"enum": ["summary", "financial", "text", "source"]}}, ["tab"])
    ),
    ActionSpec(
        "OPEN_DOCUMENT",
        obj(
            {
                "side": {"enum": ["previous", "current"]},
                "sectionNo": {"type": "integer"},
                "blockNo": {"type": "integer"},
            },
            ["side", "sectionNo"],
        ),
    ),
    ActionSpec(
        "CONFIRM_SAVE_NOTE",
        obj(
            {
                "note": obj(
                    {
                        "kind": {"enum": ["FINANCIAL_CHANGE", "TEXT_CHANGE", "ANSWER_CITATION"]},
                        "changeId": {"type": "integer"},
                    },
                    ["kind"],
                )
            },
            ["note"],
        ),
    ),
    ActionSpec("CONFIRM_FAVORITE", obj({}, [])),
]
# backend ToolTexts.outline의 줄 꼴
OUTLINE_RESULT = ToolResult(
    "c1",
    "get_document_outline",
    {"side": "current"},
    True,
    items=[
        ResultItem("R#S2", "[항목 2] I. 회사의 개요 — 하위: [항목 3] 1. 회사의 개요"),
        ResultItem(
            "R#S10",
            "[항목 10] II. 사업의 내용 — 하위: [항목 11] 1. 사업의 개요"
            " [항목 12] 2. 주요 제품 및 서비스",
        ),
    ],
)


def step(
    message: str,
    context: dict[str, Any] | None = None,
    results: list[ToolResult] | None = None,
    actions: list[ActionSpec] | None = None,
) -> StepInput:
    return StepInput(
        "예시전자",
        "반기보고서 (2025.06)",
        "반기보고서 (2026.06)",
        message,
        [],
        context or {},
        [OUTLINE],
        ACTIONS if actions is None else actions,
        results or [],
        4,
    )


def test_tab_request_answers_with_open_tab_without_llm() -> None:
    provider = FakeProvider(script=[])
    client = LlmClient(provider, LlmSettings(provider="fake", model="fake-model"))

    output = run_step(client, step("재무 수치 열어줘"))

    assert output.kind == FINAL
    assert output.final == FinalAnswer(
        ANSWERED,
        answer="아래 버튼을 누르면 재무 수치 탭을 열어요.",
        actions=[{"type": "OPEN_TAB", "tab": "financial"}],
    )
    assert output.model is None
    assert output.calls == []
    assert provider.requests == []


def test_tab_name_wins_over_section_title_and_ignores_spaces_and_punctuation() -> None:
    final = match_rule(step("원문 탭 보여 줘!"))

    assert isinstance(final, FinalAnswer)
    assert final.actions == [{"type": "OPEN_TAB", "tab": "source"}]


def test_section_request_first_fetches_outline_without_llm() -> None:
    call = match_rule(step("사업의 내용 열어줘"))

    assert call == ToolCall("c1", "get_document_outline", {"side": "current"})


def test_section_request_opens_the_only_matching_section_after_outline() -> None:
    final = match_rule(step("사업의 내용 열어줘", results=[OUTLINE_RESULT]))

    assert isinstance(final, FinalAnswer)
    assert final.answer == "아래 버튼을 누르면 원문의 '사업의 내용' 항목을 열어요."
    assert final.actions == [{"type": "OPEN_DOCUMENT", "side": "current", "sectionNo": 10}]
    sub = match_rule(step("주요 제품 및 서비스 항목 보여줘", results=[OUTLINE_RESULT]))
    assert isinstance(sub, FinalAnswer)
    assert sub.actions[0]["sectionNo"] == 12


def test_truncated_outline_does_not_open_a_section() -> None:
    truncated = ToolResult(
        "c1",
        "get_document_outline",
        {"side": "current"},
        True,
        truncated=True,
        items=OUTLINE_RESULT.items,
    )

    assert match_rule(step("사업의 내용 열어줘", results=[truncated])) is None


def test_show_request_for_information_does_not_fetch_outline() -> None:
    assert match_rule(step("최대주주 보여줘")) is None
    assert match_rule(step("주요 제품 및 서비스 항목 보여줘")) == ToolCall(
        "c1", "get_document_outline", {"side": "current"}
    )
    # 탭은 '보여줘'도 연다
    tab = match_rule(step("문장 변화 보여줘"))
    assert isinstance(tab, FinalAnswer)
    assert tab.actions == [{"type": "OPEN_TAB", "tab": "text"}]


def test_section_title_matching_two_sections_or_none_goes_to_llm() -> None:
    # '회사의 개요'는 최상위(2)와 하위(3) 두 항목에 있다
    assert match_rule(step("회사의 개요 열어줘", results=[OUTLINE_RESULT])) is None
    assert match_rule(step("감사인의 감사의견 열어줘", results=[OUTLINE_RESULT])) is None


def test_section_lookup_goes_to_llm_with_outline_already_fetched() -> None:
    provider = FakeProvider(
        script=[{"decision": "CALL_TOOLS", "toolCalls": []}],
    )
    client = LlmClient(provider, LlmSettings(provider="fake", model="fake-model"))

    run_step(client, step("회사의 개요 열어줘", results=[OUTLINE_RESULT]))

    assert [r.task for r in provider.requests][:1] == [TASK_PLAN]


def test_favorite_request_returns_confirm_favorite() -> None:
    final = match_rule(step("이 기업 관심 기업에 추가해줘"))

    assert isinstance(final, FinalAnswer)
    assert final.answer == "아래 버튼을 누르면 관심 기업에 추가해요."
    assert final.actions == [{"type": "CONFIRM_FAVORITE"}]


def test_note_request_uses_selected_change_and_needs_one() -> None:
    financial = match_rule(step("이거 노트에 담아줘", context={"financialChangeId": 31}))
    text = match_rule(step("노트에 저장해 주세요", context={"textChangeId": 5012}))

    assert isinstance(financial, FinalAnswer) and isinstance(text, FinalAnswer)
    assert financial.actions == [
        {"type": "CONFIRM_SAVE_NOTE", "note": {"kind": "FINANCIAL_CHANGE", "changeId": 31}}
    ]
    assert text.actions[0]["note"] == {"kind": "TEXT_CHANGE", "changeId": 5012}
    assert match_rule(step("이거 노트에 담아줘")) is None


def test_note_target_follows_the_active_tab_and_falls_back_when_ambiguous() -> None:
    both = {"textChangeId": 5012, "financialChangeId": 31}
    on_financial = match_rule(step("이거 노트에 담아줘", context={"tab": "financial", **both}))
    on_text = match_rule(step("이거 노트에 담아줘", context={"tab": "text", **both}))

    assert isinstance(on_financial, FinalAnswer) and isinstance(on_text, FinalAnswer)
    assert on_financial.actions[0]["note"] == {"kind": "FINANCIAL_CHANGE", "changeId": 31}
    assert on_text.actions[0]["note"] == {"kind": "TEXT_CHANGE", "changeId": 5012}
    assert match_rule(step("이거 노트에 담아줘", context={"tab": "source", **both})) is None


def test_requests_outside_the_patterns_go_to_llm() -> None:
    for message in [
        "사업의 내용에서 소송 찾아 열어줘",
        "SK 관심 기업에 추가해줘",
        "영업이익 변화 알려주고 노트에도 담아줘",
        "소송 관련 변경 보여줘",
    ]:
        result = match_rule(step(message, context={"financialChangeId": 31}))
        assert not isinstance(result, FinalAnswer), message
    # 변경 찾기 말('관련'·'변경'·'변화')이 든 요청은 목차도 받지 않는다
    assert match_rule(step("소송 관련 변경 보여줘")) is None


def test_rule_is_not_used_when_its_action_is_not_offered() -> None:
    assert match_rule(step("재무 수치 열어줘", actions=[])) is None


def test_section_request_needs_remaining_steps_for_the_outline_call() -> None:
    no_steps = StepInput(
        "예시전자",
        None,
        "반기보고서 (2026.06)",
        "사업의 내용 열어줘",
        [],
        {},
        [OUTLINE],
        ACTIONS,
        [],
        0,
    )

    assert match_rule(no_steps) is None


def test_rule_tool_call_kind_is_tool_calls() -> None:
    provider = FakeProvider(script=[])
    client = LlmClient(provider, LlmSettings(provider="fake", model="fake-model"))

    output = run_step(client, step("사업의 내용 열어줘"))

    assert output.kind == TOOL_CALLS
    assert [c.name for c in output.tool_calls] == ["get_document_outline"]
    assert provider.requests == []
