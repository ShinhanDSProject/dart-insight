"""에이전트 프롬프트의 캐시 순서(#633): 바뀌지 않는 앞부분이 요청마다 똑같아야 제공자가 캐시한다."""

from app.agent.model import ActionSpec, ResultItem, StepInput, ToolResult, ToolSpec, Turn
from app.agent.prompt import build_answer_request, build_plan_request

NO_ARGS = {"type": "object", "properties": {}, "required": [], "additionalProperties": False}
TOOLS = [
    ToolSpec("get_summary", "저장된 요약", NO_ARGS),
    ToolSpec("get_financial_changes", "재무", NO_ARGS),
]
ACTIONS = [ActionSpec("OPEN_TAB", NO_ARGS)]


def step(message: str, company: str, results: list[ToolResult] | None = None) -> StepInput:
    return StepInput(
        company,
        "반기보고서 (2025.06)",
        "반기보고서 (2026.06)",
        message,
        [Turn("user", "안녕")],
        {"tab": "summary"},
        TOOLS,
        ACTIONS,
        results or [],
        4,
    )


def common_prefix(a: str, b: str) -> str:
    n = 0
    while n < min(len(a), len(b)) and a[n] == b[n]:
        n += 1
    return a[:n]


def test_plan_prompt_keeps_tool_and_action_lists_before_changing_parts() -> None:
    first = build_plan_request(step("영업이익 어디 있어?", "예시전자")).user
    second = build_plan_request(
        step(
            "소송 관련 변경 보여줘",
            "다른전자",
            [ToolResult("c1", "get_summary", {}, True, items=[ResultItem("F1", "사실 문장")])],
        )
    ).user

    shared = common_prefix(first, second)
    # 회사·질문·결과가 달라도 Tool 목록과 액션 목록 전체가 같은 앞부분에 들어 있다
    assert shared.startswith("[Tool]")
    assert '<tool name="get_financial_changes"' in shared
    assert '<action type="OPEN_TAB">' in shared
    # 바뀌는 값(회사·질문)은 공통 앞부분 뒤에만 있다
    assert "예시전자" not in shared
    assert "영업이익" not in shared


def test_answer_prompt_keeps_action_list_before_changing_parts() -> None:
    first = build_answer_request(step("영업이익 어디 있어?", "예시전자"), []).user
    second = build_answer_request(
        step("소송 관련 변경 보여줘", "다른전자"), ["근거 표시가 없어요."]
    ).user

    shared = common_prefix(first, second)
    assert shared.startswith("[액션]")
    assert '<action type="OPEN_TAB">' in shared
    assert "예시전자" not in shared


def test_plan_and_answer_mark_shared_prefix_for_block_caching() -> None:
    plan = build_plan_request(step("영업이익 어디 있어?", "예시전자"))
    answer = build_answer_request(step("영업이익 어디 있어?", "예시전자"), [])

    # 블록 단위로 캐시하는 제공자(Anthropic)가 Tool·액션 목록 끝에 캐시 지점을 둔다(ADR-0062)
    for request in (plan, answer):
        shared = request.user[: request.user_cache_prefix]
        assert request.user_cache_prefix > 0
        assert '<action type="OPEN_TAB">' in shared
        assert "예시전자" not in shared
        assert "영업이익" not in shared
    assert '<tool name="get_financial_changes"' in plan.user[: plan.user_cache_prefix]
