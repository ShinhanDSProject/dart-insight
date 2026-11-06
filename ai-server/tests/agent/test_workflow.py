"""정해진 Tool 순서로 처리하는 요청(#581): 원인 추적·교차 검증 Workflow와 교차 검증 판정.

교차 검증 결과는 Tool 결과 묶음을 고정해 코드가 정한 값을 확인한다(AC19).
"""

from app.agent import fake, workflow
from app.agent.model import (
    FINAL,
    TOOL_CALLS,
    Facts,
    ResultItem,
    StepInput,
    ToolResult,
    ToolSpec,
)
from app.agent.prompt import TASK_ANSWER, TASK_PLAN, plan_schema
from app.agent.service import run_step
from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient

SETTINGS = LlmSettings(provider="fake", model="fake-model", max_retries=0, max_output_retries=2)
NO_ARGS = {"type": "object", "properties": {}, "required": [], "additionalProperties": False}
FINANCIAL_TOOL = ToolSpec(
    "get_financial_changes",
    "재무 계정 변화",
    {
        "type": "object",
        "properties": {"q": {"type": "string"}, "size": {"type": "integer"}},
        "required": [],
        "additionalProperties": False,
    },
)
SUMMARY_TOOL = ToolSpec("get_summary", "저장된 요약", NO_ARGS)
PLANS_TOOL = ToolSpec("get_plan_followups", "작년 계획 대조", NO_ARGS)
SEARCH_TOOL = ToolSpec(
    "search_text_changes",
    "문장 변경을 거른다",
    {
        "type": "object",
        "properties": {"q": {"type": "string", "minLength": 2}},
        "required": [],
        "additionalProperties": False,
    },
)
ALL_TOOLS = [FINANCIAL_TOOL, SUMMARY_TOOL, PLANS_TOOL, SEARCH_TOOL]
CUR = "20260814003699"


def step(
    message: str = "회사 설명과 재무 수치가 일치해?",
    results: list[ToolResult] | None = None,
    tools: list[ToolSpec] | None = None,
    remaining: int = 4,
) -> StepInput:
    return StepInput(
        "예시전자",
        "반기보고서 (2025.06)",
        "반기보고서 (2026.06)",
        message,
        [],
        {"tab": "summary"},
        ALL_TOOLS if tools is None else tools,
        [],
        results or [],
        remaining,
    )


def llm(*script: object) -> tuple[LlmClient, FakeProvider]:
    provider = FakeProvider(
        script=script,
        responders={TASK_PLAN: fake.respond_plan, TASK_ANSWER: fake.respond_answer},
    )
    return LlmClient(provider, SETTINGS), provider


def change(change_id: int, direction: str | None, status: str = "OK") -> ResultItem:
    return ResultItem(
        f"F{change_id}",
        f"[IS, changeId {change_id}] 계정 {change_id}이 바뀌었어요.",
        facts=Facts(change_id, direction, status),
    )


def quote(change_id: int, text: str, grade: str = "RELATED", block: int = 5) -> ResultItem:
    return ResultItem(
        f"{CUR}#B{block}",
        f"[요약 인용, 등급 {grade}] {text}",
        grade=grade,
        facts=Facts(change_id),
    )


def summary_line(change_id: int, grade: str = "RELATED") -> ResultItem:
    return ResultItem(
        f"F{change_id}",
        f"[요약 재무, changeId {change_id}, 등급 {grade}] 사실 문장",
        grade=grade,
        facts=Facts(change_id),
    )


def bundle(
    changes: list[ResultItem], summary: list[ResultItem], prefix: str = "cross-"
) -> list[ToolResult]:
    return [
        ToolResult(f"{prefix}1", "get_financial_changes", {}, True, items=changes),
        ToolResult(f"{prefix}2", "get_summary", {}, True, items=summary),
    ]


def pick(kind: str, account: str | None = None) -> dict:
    return {
        "decision": "CALL_TOOLS",
        "toolCalls": [],
        "draft": None,
        "workflow": {"type": kind, "account": account},
    }


# --- 교차 검증 판정(AC19): Tool 결과 묶음을 고정하고 결과를 확인한다 ---


def test_cross_check_is_consistent_when_explanation_direction_matches() -> None:
    results = bundle(
        [change(1, "DOWN")],
        [summary_line(1), quote(1, "반도체 수요 부진으로 영업이익이 감소했습니다.")],
    )

    check = workflow.cross_check(step(results=results))

    assert check.result == workflow.CONSISTENT
    assert "1개" in check.reason


def test_cross_check_flags_potential_mismatch_when_direction_is_opposite() -> None:
    results = bundle(
        [change(1, "DOWN"), change(2, "UP")],
        [
            quote(1, "영업이익은 전년 대비 증가하였습니다.", block=5),
            quote(2, "매출은 신제품 출시로 늘어났습니다.", block=6),
        ],
    )

    check = workflow.cross_check(step(results=results))

    assert check.result == workflow.POTENTIAL_MISMATCH
    assert "2개 중 1개" in check.reason
    assert "확정" in check.reason


def test_cross_check_is_not_comparable_when_only_other_basis_accounts() -> None:
    results = bundle(
        [change(1, "DOWN", "AMBIGUOUS_MATCH"), change(2, None, "PERIOD_MISMATCH")],
        [quote(1, "영업이익이 감소했습니다.")],
    )

    assert workflow.cross_check(step(results=results)).result == workflow.NOT_COMPARABLE


def test_cross_check_is_insufficient_without_explanation_quotes() -> None:
    # 재무 요약 줄(F…)은 등급이 있어도 원문 인용이 아니라 대조하지 않는다
    results = bundle([change(1, "DOWN")], [summary_line(1)])

    assert workflow.cross_check(step(results=results)).result == workflow.INSUFFICIENT_EVIDENCE


def test_cross_check_ignores_quotes_without_one_direction() -> None:
    # 한 인용에 양쪽 방향 낱말(여러 계정이 섞임)이나 가치판단 낱말만 있으면 방향 없음
    results = bundle(
        [change(1, "DOWN"), change(2, "UP")],
        [
            quote(1, "매출은 증가했으나 원가가 늘고 이익은 감소했습니다.", block=5),
            quote(2, "수익성이 개선되었습니다.", block=6),
        ],
    )

    assert workflow.cross_check(step(results=results)).result == workflow.INSUFFICIENT_EVIDENCE


def test_cross_check_skips_loss_accounts_and_unrated_quotes() -> None:
    # 손실 계정은 대조하지 않고, 등급이 NONE이거나 다른 계정의 인용은 쓰지 않는다
    results = bundle(
        [change(1, "UP", "LOSS_NARROWED"), change(2, "DOWN")],
        [
            quote(1, "영업손실이 감소했습니다.", block=5),
            quote(2, "영업이익이 증가했습니다.", grade="NONE", block=6),
            quote(3, "매출이 증가했습니다.", block=7),
        ],
    )

    assert workflow.cross_check(step(results=results)).result == workflow.INSUFFICIENT_EVIDENCE


def test_cross_check_uses_comparable_accounts_beside_other_basis_ones() -> None:
    results = bundle(
        [change(1, "UP", "TURNED_PROFIT"), change(2, "DOWN", "AMBIGUOUS_MATCH")],
        [quote(1, "영업이익이 흑자로 전환되며 크게 증가했습니다.")],
    )

    assert workflow.cross_check(step(results=results)).result == workflow.CONSISTENT


def test_cross_check_does_not_use_plan_followups() -> None:
    # 계획 대조는 이행 여부를 평가하지 않으므로(ADR-0041) '찾지 못함'이 있어도 결과를 바꾸지 않는다
    results = [
        *bundle([change(1, "DOWN")], [quote(1, "영업이익이 감소했습니다.")]),
        ToolResult(
            "cross-3",
            "get_plan_followups",
            {},
            True,
            items=[ResultItem(None, "[올해 대조 1, 찾지 못함] 관련 문단 없음")],
        ),
    ]

    assert workflow.cross_check(step(results=results)).result == workflow.CONSISTENT


# --- Workflow 흐름 ---


def test_first_plan_choosing_cross_check_calls_tools_in_code_order() -> None:
    client, _ = llm(pick(workflow.CROSS_CHECK, "영업이익"))

    output = run_step(client, step())

    assert output.kind == TOOL_CALLS
    assert [(c.call_id, c.name, c.arguments) for c in output.tool_calls] == [
        ("cross-1", "get_financial_changes", {"q": "영업이익"}),
        ("cross-2", "get_summary", {}),
        ("cross-3", "get_plan_followups", {}),
    ]


def test_cross_check_result_is_attached_by_code_and_not_changed_by_llm() -> None:
    results = bundle(
        [change(1, "DOWN")],
        [quote(1, "영업이익은 전년 대비 증가하였습니다.")],
    )
    client, provider = llm(
        {
            "status": "ANSWERED",
            "answer": "회사 설명과 수치가 일치해요[F1].",
            "evidenceIds": ["F1"],
            "actions": [],
        }
    )

    output = run_step(client, step(results=results))

    assert output.kind == FINAL
    assert output.final is not None
    assert output.final.cross_check is not None
    assert output.final.cross_check.result == workflow.POTENTIAL_MISMATCH
    # Workflow가 진행 중이면 Tool을 다시 고르지 않고 답만 쓴다
    assert [r.task for r in provider.requests] == [TASK_ANSWER]
    assert "[교차 검증] 서비스가 정한 결과: POTENTIAL_MISMATCH" in provider.requests[0].user


def test_cross_check_is_attached_even_when_answer_needs_review() -> None:
    results = bundle([change(1, "DOWN")], [quote(1, "영업이익이 감소했습니다.")])
    wrong = {"status": "ANSWERED", "answer": "근거 없는 답이에요.", "evidenceIds": []}
    wrong["actions"] = []
    client, _ = llm(wrong, wrong, wrong)

    output = run_step(client, step(results=results))

    assert output.final is not None
    assert output.final.status == "REVIEW_NEEDED"
    assert output.final.cross_check is not None
    assert output.final.cross_check.result == workflow.CONSISTENT


def test_workflow_is_not_used_when_required_tool_is_missing() -> None:
    tools = [FINANCIAL_TOOL, SEARCH_TOOL]
    client, provider = llm(
        {
            "decision": "CALL_TOOLS",
            "toolCalls": [{"name": "get_financial_changes", "arguments": {}}],
            "draft": None,
            "workflow": {"type": workflow.CROSS_CHECK, "account": None},
        }
    )

    output = run_step(client, step(tools=tools))

    assert workflow.available(step(tools=tools)) == []
    assert plan_schema(step(tools=tools))["properties"]["workflow"] == {"type": "null"}
    # 일반 경로: LLM이 고른 Tool을 그대로 부른다
    assert [(c.call_id, c.name) for c in output.tool_calls] == [("c1", "get_financial_changes")]
    assert provider.requests[0].task == TASK_PLAN


def test_workflow_is_not_chosen_after_other_tools_ran() -> None:
    ran = [ToolResult("c1", "search_text_changes", {"q": "소송"}, True)]

    assert workflow.choice(pick(workflow.CROSS_CHECK), step(results=ran)) is None
    assert plan_schema(step(results=ran))["properties"]["workflow"] == {"type": "null"}


def test_selected_change_from_screen_does_not_block_workflow() -> None:
    selected = [ToolResult("ctx-financial", "get_financial_changes", {}, True)]

    assert workflow.choice(pick(workflow.CAUSE_TRACE), step(results=selected)) is not None


def test_cause_trace_searches_text_changes_when_no_explanation_quote() -> None:
    results = [
        ToolResult(
            "cause-1", "get_financial_changes", {"q": "영업이익"}, True, items=[change(1, "DOWN")]
        ),
        ToolResult("cause-2", "get_summary", {}, True, items=[summary_line(1, "NONE")]),
    ]
    client, provider = llm()

    output = run_step(client, step("영업이익 감소와 관련된 변경 문장", results=results))

    assert output.kind == TOOL_CALLS
    assert [(c.call_id, c.name, c.arguments) for c in output.tool_calls] == [
        ("cause-3", "search_text_changes", {"q": "영업이익"})
    ]
    assert provider.requests == []


def test_cause_trace_answers_with_stored_quote_without_searching() -> None:
    results = bundle(
        [change(1, "DOWN")],
        [quote(1, "반도체 수요 부진으로 영업이익이 감소했습니다.", grade="STATED")],
        prefix="cause-",
    )
    client, provider = llm()

    output = run_step(client, step("영업이익이 왜 줄었어?", results=results))

    assert output.kind == FINAL
    assert output.final is not None
    assert output.final.cross_check is None
    assert [r.task for r in provider.requests] == [TASK_ANSWER]
    assert "[원인 추적]" in provider.requests[0].user


def test_cause_trace_stops_when_no_steps_remain() -> None:
    results = [
        ToolResult(
            "cause-1", "get_financial_changes", {"q": "영업이익"}, True, items=[change(1, "DOWN")]
        ),
        ToolResult("cause-2", "get_summary", {}, True),
    ]

    assert workflow.next_calls(step(results=results, remaining=0), workflow.CAUSE_TRACE) == []
