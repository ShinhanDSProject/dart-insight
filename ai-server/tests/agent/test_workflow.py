"""정해진 Tool 순서로 처리하는 요청(#581): 원인 추적·교차 검증 Workflow와 교차 검증 판정.

교차 검증 결과는 Tool 결과 묶음을 고정해 코드가 정한 값을 확인한다(AC19).
"""

from app.agent import fake, workflow
from app.agent.model import (
    FINAL,
    TOOL_CALLS,
    ActionSpec,
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


def test_cross_check_counts_account_once_when_selected_on_screen() -> None:
    # 화면에서 고른 변경(ctx-financial)과 Workflow 결과에 같은 계정이 있어도 한 번만 센다
    selected = ToolResult(
        "ctx-financial", "get_financial_changes", {"changeId": 1}, True, items=[change(1, "DOWN")]
    )
    results = [selected, *bundle([change(1, "DOWN")], [quote(1, "영업이익이 증가했습니다.")])]

    check = workflow.cross_check(step(results=results))

    assert check.result == workflow.POTENTIAL_MISMATCH
    assert "1개 중 1개" in check.reason


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


def test_cause_trace_searches_when_quotes_belong_only_to_other_accounts() -> None:
    results = [
        ToolResult(
            "cause-1", "get_financial_changes", {"q": "영업이익"}, True, items=[change(1, "DOWN")]
        ),
        ToolResult("cause-2", "get_summary", {}, True, items=[quote(2, "매출은 증가했습니다.")]),
    ]

    calls = workflow.next_calls(step(results=results), workflow.CAUSE_TRACE)

    assert [(c.name, c.arguments) for c in calls] == [("search_text_changes", {"q": "영업이익"})]


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


# --- 용어 풀이(TERM, ADR-0061, #770) ---

LOOKUP_TOOL = ToolSpec(
    "lookup_terms",
    "용어 카드",
    {
        "type": "object",
        "properties": {"terms": {"type": "array", "items": {"type": "string"}}},
        "required": ["terms"],
        "additionalProperties": False,
    },
)
CHECKPOINT_TOOL = ToolSpec("get_checkpoints", "체크 포인트", NO_ARGS)
QUESTION_TOOL = ToolSpec(
    "answer_with_evidence",
    "근거 질문",
    {
        "type": "object",
        "properties": {"question": {"type": "string"}},
        "required": ["question"],
        "additionalProperties": False,
    },
)
TERM_TOOLS = [LOOKUP_TOOL, FINANCIAL_TOOL, SEARCH_TOOL, CHECKPOINT_TOOL, QUESTION_TOOL]
GLOSSARY_ACTION = ActionSpec(
    "OPEN_GLOSSARY",
    {
        "type": "object",
        "properties": {"term": {"type": "string"}},
        "required": ["term"],
        "additionalProperties": False,
    },
)


def term_step(
    message: str,
    results: list[ToolResult] | None = None,
    tools: list[ToolSpec] | None = None,
    actions: list[ActionSpec] | None = None,
) -> StepInput:
    return StepInput(
        "예시전자",
        "반기보고서 (2025.06)",
        "반기보고서 (2026.06)",
        message,
        [],
        {"tab": "summary"},
        TERM_TOOLS if tools is None else tools,
        [GLOSSARY_ACTION] if actions is None else actions,
        results or [],
        4,
    )


def pick_term(term: str | None) -> dict:
    return {
        "decision": "CALL_TOOLS",
        "toolCalls": [],
        "draft": None,
        "workflow": {"type": workflow.TERM, "account": None, "term": term},
    }


def card_line(
    key: str,
    term: str,
    level: str = "핵심",
    example: str | None = "자본총계가 100원이고 부채총계가 30원이면 부채비율은 30%예요.",
    company_value: str | None = None,
) -> ResultItem:
    """backend TermLines.card와 같은 모양의 줄."""
    parts = [f"[용어 카드 {term}, {level} 카드, 키 {key}] 한 줄 뜻: {term}의 뜻이에요."]
    if example:
        parts.append(f"쉬운 예시(가정한 예, 이 회사의 값이 아님): {example}")
    parts.append("확인할 곳: 재무상태표")
    if company_value:
        parts.append(f"이 회사 값을 찾을 곳: {company_value}")
    parts.append("출처: 공식 자료")
    return ResultItem(f"G{key}", " / ".join(parts))


def missing_line(query: str, similar: str | None = None) -> ResultItem:
    """backend TermLines.notFound와 같은 모양의 줄."""
    text = f"[용어 카드 없음] '{query}'에 해당하는 용어 카드는 등록되지 않았어요."
    if similar:
        text += f" 비슷한 카드: {similar}"
    return ResultItem(None, text)


def lookup(*items: ResultItem, terms: list[str] | None = None) -> ToolResult:
    arguments = {"terms": terms or ["부채비율"]}
    return ToolResult("term-1", "lookup_terms", arguments, True, items=list(items))


DEBT_VALUE = (
    "체크 포인트 DEBT_RATIO(get_checkpoints, 최근 사업보고서 기준), "
    "재무 계정 부채총계·자본총계(get_financial_changes, 이 분석의 두 보고서)"
)
BLOCK_ID = f"{CUR}#B12"


def test_first_plan_choosing_term_looks_up_the_term_first() -> None:
    client, _ = llm(pick_term("부채비율, 유동비율"))

    output = run_step(client, term_step("부채비율과 유동비율 차이는?"))

    assert output.kind == TOOL_CALLS
    assert [(c.call_id, c.name, c.arguments) for c in output.tool_calls] == [
        ("term-1", "lookup_terms", {"terms": ["부채비율", "유동비율"]}),
    ]


def test_term_without_term_is_not_started() -> None:
    assert workflow.choice(pick_term(None), term_step("뭐야?")) is None
    assert workflow.choice(pick_term(" "), term_step("뭐야?")) is None


def test_card_with_accounts_asks_this_analysis_values_and_text_changes() -> None:
    results = [lookup(card_line("debtRatio", "부채비율", company_value=DEBT_VALUE))]

    calls = workflow.next_calls(term_step("부채비율이 뭐야?", results), workflow.TERM)

    # 이 분석 기간의 재무 계정 변화를 체크포인트보다 먼저 쓴다
    assert [(c.name, c.arguments) for c in calls] == [
        ("get_financial_changes", {"q": "부채총계"}),
        ("get_financial_changes", {"q": "자본총계"}),
        ("search_text_changes", {"q": "부채비율"}),
    ]
    assert all(c.call_id.startswith("term-") for c in calls)


def test_card_with_only_checkpoint_asks_checkpoints_and_text_changes() -> None:
    value = "체크 포인트 AUDIT_OPINION(get_checkpoints, 최근 사업보고서 기준)"
    results = [lookup(card_line("auditOpinion", "감사의견", company_value=value))]

    calls = workflow.next_calls(term_step("감사의견이 뭐야?", results), workflow.TERM)

    assert [c.name for c in calls] == ["get_checkpoints", "search_text_changes"]


def test_missing_card_searches_report_explanation_with_term_only() -> None:
    results = [lookup(missing_line("리스부채"), terms=["리스부채"])]

    calls = workflow.next_calls(term_step("리스부채가 뭐야?", results), workflow.TERM)

    assert [(c.name, c.arguments) for c in calls] == [
        ("answer_with_evidence", {"question": "리스부채"}),
    ]


def test_term_asks_once_and_then_answers_with_card_order_guide() -> None:
    results = [
        lookup(card_line("debtRatio", "부채비율", company_value=DEBT_VALUE)),
        ToolResult("term-2", "search_text_changes", {"q": "부채비율"}, True),
    ]
    answer_text = "부채비율은 부채비율의 뜻이에요[GdebtRatio]."
    client, provider = llm(
        {"status": "ANSWERED", "answer": answer_text, "evidenceIds": ["GdebtRatio"], "actions": []}
    )

    output = run_step(client, term_step("부채비율이 뭐야?", results))

    assert output.final is not None
    assert output.final.status == "ANSWERED"
    assert [r.task for r in provider.requests] == [TASK_ANSWER]
    guide = provider.requests[0].user
    assert "[용어 풀이]" in guide
    assert "1) 한 줄 뜻 2) 쉬운 예시 3) 이 회사에서는 4) 확인할 곳" in guide
    assert "이번에 바뀐 문장에서는 찾지" in guide
    assert "한 줄 뜻과 이 회사 값만" not in guide


def test_basic_card_guide_asks_for_short_answer() -> None:
    results = [
        lookup(card_line("asset", "자산", level="기초", example=None), terms=["자산"]),
        ToolResult("term-2", "search_text_changes", {"q": "자산"}, True),
    ]
    client, provider = llm(
        {
            "status": "ANSWERED",
            "answer": "자산은 자산의 뜻이에요[Gasset].",
            "evidenceIds": ["Gasset"],
            "actions": [],
        }
    )

    run_step(client, term_step("자산이 뭐야?", results))

    assert "한 줄 뜻과 이 회사 값만 두세 문장으로" in provider.requests[0].user


def test_card_only_sentence_naming_the_company_is_rejected_then_fixed() -> None:
    results = [
        lookup(card_line("debtRatio", "부채비율")),
        ToolResult("term-2", "search_text_changes", {"q": "부채비율"}, True),
    ]
    bad = "예시전자의 부채비율은 30%예요[GdebtRatio]."
    good = "예를 들어 부채총계가 30원이면 부채비율은 30%예요[GdebtRatio]."
    client, _ = llm(
        {"status": "ANSWERED", "answer": bad, "evidenceIds": ["GdebtRatio"], "actions": []},
        {"status": "ANSWERED", "answer": good, "evidenceIds": ["GdebtRatio"], "actions": []},
    )

    output = run_step(client, term_step("부채비율이 뭐야?", results))

    assert output.rejections[0].rules == ["GLOSSARY_COMPANY_REFERENCE"]
    assert output.final is not None
    assert output.final.answer == good


def test_card_example_number_in_company_sentence_ends_review_needed() -> None:
    results = [
        lookup(card_line("debtRatio", "부채비율")),
        ToolResult(
            "term-2",
            "get_financial_changes",
            {"q": "부채총계"},
            True,
            items=[
                ResultItem("F7", "[BS, changeId 7] 부채총계가 1,200억 원에서 1,500억 원이 됐어요.")
            ],
        ),
    ]
    # 카드 예시의 30%를 회사 근거(F7) 문장에 쓰면 숫자 검사로 반려된다(AC6)
    wrong = {
        "status": "ANSWERED",
        "answer": "이 회사의 부채비율은 30%예요[F7].",
        "evidenceIds": ["F7"],
        "actions": [],
    }
    client, _ = llm(wrong, wrong, wrong)

    output = run_step(client, term_step("부채비율이 뭐야?", results))

    assert output.final is not None
    assert output.final.status == "REVIEW_NEEDED"
    assert {r for rej in output.rejections for r in rej.rules} == {"NUMBER_NOT_IN_TOOL_RESULT"}


def test_no_card_and_no_report_explanation_is_fixed_answer_with_similar_buttons() -> None:
    results = [
        lookup(missing_line("부채율", "부채비율(debtRatio), 부채(debt)"), terms=["부채율"]),
        ToolResult(
            "term-2",
            "answer_with_evidence",
            {"question": "부채율"},
            True,
            items=[ResultItem(None, "[질문 ID 3, NOT_FOUND] 찾지 못했어요.")],
        ),
    ]
    client, provider = llm()

    output = run_step(client, term_step("부채율이 뭐야?", results))

    assert output.kind == FINAL
    assert output.final is not None
    assert output.final.status == "ANSWERED"
    assert output.final.answer == (
        "'부채율'에 해당하는 용어 카드가 없고, 이 보고서에서도 설명을 찾지 못했어요."
    )
    assert output.final.evidence_ids == []
    assert output.final.actions == [
        {"type": "OPEN_GLOSSARY", "term": "부채비율"},
        {"type": "OPEN_GLOSSARY", "term": "부채"},
    ]
    # LLM 없이 끝낸다(정해진 안내)
    assert provider.requests == []
    assert output.model is None


def test_fixed_answer_without_similar_cards_offers_basic_cards() -> None:
    results = [
        lookup(missing_line("파생상품"), terms=["파생상품"]),
        ToolResult("term-2", "answer_with_evidence", {"question": "파생상품"}, True),
    ]
    client, _ = llm()

    output = run_step(client, term_step("파생상품이 뭐야?", results))

    assert output.final is not None
    assert [a["term"] for a in output.final.actions] == ["자산", "매출", "주식"]


def test_fixed_answer_waits_for_report_search_when_tool_exists() -> None:
    results = [lookup(missing_line("리스부채"), terms=["리스부채"])]

    assert workflow.term_fixed_final(term_step("리스부채가 뭐야?", results)) is None


QUOTE = "리스부채는 리스료의 현재가치로 측정합니다. 이후 이자비용을 인식합니다."


def report_results(quote_text: str) -> list[ToolResult]:
    return [
        lookup(missing_line("리스부채"), terms=["리스부채"]),
        ToolResult(
            "term-2",
            "answer_with_evidence",
            {"question": "리스부채"},
            True,
            items=[
                ResultItem(None, "[질문 ID 4, ANSWERED] 리스부채는 측정 방법이 적혀 있어요."),
                ResultItem(BLOCK_ID, f"[인용 1, 질문 ID 4] 주석 > 2. 회계정책: {quote_text}"),
            ],
        ),
    ]


def test_report_explanation_requires_term_in_block_quote() -> None:
    found = workflow.report_explanation(term_step("리스부채가 뭐야?", report_results(QUOTE)))
    other = report_results("사용권자산은 원가로 측정합니다.")

    assert found == (BLOCK_ID, QUOTE)
    assert workflow.report_explanation(term_step("리스부채가 뭐야?", other)) is None


def test_report_explanation_answer_must_stay_within_quote_words() -> None:
    step_ = term_step("리스부채가 뭐야?", report_results(QUOTE))
    intro = workflow.REPORT_QUOTE
    quoted = f'"리스부채는 리스료의 현재가치로 측정합니다."[{BLOCK_ID}]'
    good = f"{intro} {quoted} 리스료의 현재가치로 측정해요[{BLOCK_ID}]."
    invented = f"{intro} {quoted} 쉽게 말하면 빌린 돈이에요[{BLOCK_ID}]."
    unmarked = f"{intro} 리스부채는 갚을 돈이에요."

    assert workflow.term_answer_problem(good, step_) is None
    invented_problem = workflow.term_answer_problem(invented, step_)
    unmarked_problem = workflow.term_answer_problem(unmarked, step_)
    assert invented_problem is not None
    assert invented_problem[0] == "REPORT_EXPLANATION_UNSUPPORTED"
    assert unmarked_problem is not None
    assert unmarked_problem[0] == "REPORT_EXPLANATION_UNSUPPORTED"


def test_report_explanation_falls_back_to_quote_only_after_retries() -> None:
    invented = {
        "status": "ANSWERED",
        "answer": f"{workflow.REPORT_QUOTE} 쉽게 말하면 빌린 돈이에요[{BLOCK_ID}].",
        "evidenceIds": [BLOCK_ID],
        "actions": [],
    }
    client, provider = llm(invented, invented, invented)

    output = run_step(client, term_step("리스부채가 뭐야?", report_results(QUOTE)))

    assert len(provider.requests) == 3
    assert "[용어 풀이: 보고서 설명]" in provider.requests[0].user
    assert output.final is not None
    assert output.final.status == "ANSWERED"
    # 풀이를 빼고 용어가 든 원문 문장만 인용한다(정의를 지어내지 않음)
    assert output.final.answer == (
        f'{workflow.REPORT_QUOTE} "리스부채는 리스료의 현재가치로 측정합니다."[{BLOCK_ID}]'
    )
    assert output.final.evidence_ids == [BLOCK_ID]


def test_first_plan_calling_only_lookup_terms_continues_as_term_workflow() -> None:
    plan = {
        "decision": "CALL_TOOLS",
        "toolCalls": [{"name": "lookup_terms", "arguments": {"terms": ["부채비율"]}}],
        "draft": None,
        "workflow": None,
    }
    client, _ = llm(plan)

    output = run_step(client, term_step("부채비율이 뭐야?"))

    # workflow 칸을 빠뜨려도 용어 찾기 하나만 부르면 용어 풀이로 이어 간다(callId 머리 term-)
    assert [(c.call_id, c.name) for c in output.tool_calls] == [("term-1", "lookup_terms")]
