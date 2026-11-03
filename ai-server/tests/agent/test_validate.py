import pytest

from app.agent.model import ActionSpec, ResultItem, StepInput, ToolResult, ToolSpec
from app.agent.validate import (
    ACTION_INVALID,
    CAUSAL_NOT_IN_SOURCE,
    EVIDENCE_MISSING,
    EVIDENCE_NOT_IN_TOOL_RESULT,
    GRADE_CHANGED,
    MARKER_MISMATCH,
    Draft,
    parse_draft,
    parse_plan,
    review,
    schema_problem,
)
from app.llm import OutputProblem

TOOL = ToolSpec(
    "get_text_change",
    "문장 변경 상세",
    {
        "type": "object",
        "properties": {"changeId": {"type": "integer"}},
        "required": ["changeId"],
        "additionalProperties": False,
    },
)
ACTION = ActionSpec(
    "OPEN_TEXT_CHANGE",
    {
        "type": "object",
        "properties": {"changeId": {"type": "integer"}},
        "required": ["changeId"],
        "additionalProperties": False,
    },
)


def step(*items: ResultItem, ok: bool = True) -> StepInput:
    result = ToolResult("c1", "get_text_change", {"changeId": 5012}, ok, items=list(items))
    return StepInput("예시전자", None, "사업보고서", "질문", [], {}, [TOOL], [ACTION], [result], 3)


def draft(text: str, evidence: list[str], actions: list[dict] | None = None) -> Draft:
    return Draft("ANSWERED", text, evidence, actions or [])


def test_plan_arguments_must_match_tool_parameters() -> None:
    data = {"decision": "CALL_TOOLS", "toolCalls": [{"name": "get_text_change", "arguments": {}}]}

    with pytest.raises(OutputProblem) as error:
        parse_plan(data, step())

    assert "changeId" in error.value.problems[0]


def test_plan_allows_at_most_three_tool_calls() -> None:
    call = {"name": "get_text_change", "arguments": {"changeId": 1}}

    with pytest.raises(OutputProblem):
        parse_plan({"decision": "CALL_TOOLS", "toolCalls": [call] * 4}, step())


def test_plan_call_ids_continue_after_earlier_results() -> None:
    call = {"name": "get_text_change", "arguments": {"changeId": 7}}

    (parsed,) = parse_plan({"decision": "CALL_TOOLS", "toolCalls": [call]}, step())

    assert parsed.call_id == "c2"


def test_draft_needs_known_status() -> None:
    with pytest.raises(OutputProblem):
        parse_draft({"status": "MAYBE", "answer": None, "evidenceIds": [], "actions": []})


def test_answer_needs_evidence() -> None:
    reviewed = review(draft("변경이 있어요.", []), step(ResultItem("T5012", "변경")))

    assert reviewed.rules == [EVIDENCE_MISSING]


def test_evidence_must_come_from_successful_tool_result() -> None:
    failed = step(ResultItem("T5012", "변경"), ok=False)

    reviewed = review(draft("변경이 있어요[T5012].", ["T5012"]), failed)

    assert reviewed.rules == [EVIDENCE_NOT_IN_TOOL_RESULT]


def test_item_without_evidence_id_cannot_be_cited() -> None:
    reviewed = review(draft("기업이 있어요[C1].", ["C1"]), step(ResultItem(None, "기업 목록")))

    assert reviewed.rules == [EVIDENCE_NOT_IN_TOOL_RESULT]


def test_markers_must_match_evidence_ids() -> None:
    reviewed = review(draft("변경이 있어요.", ["T5012"]), step(ResultItem("T5012", "변경")))

    assert reviewed.rules == [MARKER_MISMATCH]


def test_causal_claim_needs_stated_source() -> None:
    item = ResultItem("F1", "매출이 환율 영향으로 늘었습니다.", grade="RELATED")

    reviewed = review(draft("매출은 환율 영향으로 늘었어요[F1].", ["F1"]), step(item))

    assert reviewed.rules == [CAUSAL_NOT_IN_SOURCE]


def test_causal_claim_from_stated_source_passes() -> None:
    item = ResultItem("F1", "매출이 환율 영향으로 늘었습니다.", grade="STATED")

    reviewed = review(draft("매출은 환율 영향으로 늘었어요[F1].", ["F1"]), step(item))

    assert reviewed.final is not None


def test_stated_form_cannot_raise_related_grade() -> None:
    item = ResultItem("F1", "신규 라인을 가동했습니다.", grade="RELATED")

    reviewed = review(draft("회사는 신규 라인을 가동했다고 밝혔어요[F1].", ["F1"]), step(item))

    assert reviewed.rules == [GRADE_CHANGED]


def test_action_must_be_listed_with_valid_fields() -> None:
    item = ResultItem("T5012", "변경")

    reviewed = review(
        draft("변경이 있어요[T5012].", ["T5012"], [{"type": "DELETE_POST", "postId": 1}]),
        step(item),
    )
    wrong_field = review(
        draft("변경이 있어요[T5012].", ["T5012"], [{"type": "OPEN_TEXT_CHANGE", "id": 1}]),
        step(item),
    )

    assert reviewed.rules == [ACTION_INVALID]
    assert wrong_field.rules == [ACTION_INVALID]


def test_schema_problem_rejects_boolean_for_integer() -> None:
    assert schema_problem({"changeId": True}, TOOL.parameters) is not None
    assert schema_problem({"changeId": 3}, TOOL.parameters) is None
