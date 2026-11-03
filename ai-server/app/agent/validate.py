"""에이전트 결과 검사(ADR-0045). 코드가 확인한다.

- parse_plan: 다음 Tool 고르기 결과의 형식(받은 목록의 Tool, 인자 형식, 한 번에 3개까지)
- parse_draft: 답 초안의 형식. 형식이 틀리면 LlmClient가 다시 생성한다
- review: 검토 노드의 내용 검사. 반려하면 사유(규칙 ID)를 붙여 다시 쓰게 한다
  - 근거 ID가 실행에 성공한 Tool 결과에 있음, 답의 근거 표시와 evidenceIds가 같음
  - 숫자·크기 표현이 인용한 Tool 결과에 있음(app.llm.grounding)
  - 원인 표현은 인용한 결과에도 원인 표현이 있고, 등급이 있으면 STATED일 때만(ADR-0015)
  - '회사가 밝혔다' 같은 직접 설명 꼴은 인용한 결과의 등급이 STATED일 때만(등급을 바꾸지 않음)
  - 투자 권유성 표현 검사(app.compliance) 통과. 걸리면 규칙 ID를 blocked_rules에 남긴다
  - 액션은 받은 목록의 종류와 형식(JSON Schema)만. 값이 이 분석에 실제로 있는지는 backend가
    확인하고 없으면 그 액션을 뺀다(ADR-0044, docs/api-spec.md `final.actions`)
  - Tool을 모두 실패했는데 NOT_FOUND면 다시 써도 고칠 수 없으므로 바로 '검토 필요'
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from app.agent.model import (
    ANSWERED,
    LLM_STATUSES,
    MAX_TOOL_CALLS,
    NOT_FOUND,
    FinalAnswer,
    StepInput,
    ToolCall,
)
from app.compliance import scan
from app.llm import OutputProblem
from app.llm.grounding import number_problem
from app.summary.causal import find as find_causal

MAX_ANSWER = 400

# 다음 Tool 고르기 결과(decision)
CALL_TOOLS = "CALL_TOOLS"
ANSWER = "ANSWER"
DECISIONS = (CALL_TOOLS, ANSWER)

# 재무 설명 등급(ADR-0015)
GRADE_STATED = "STATED"

# 검토 노드가 반려한 규칙(응답 rejections[].rules)
ANSWER_EMPTY = "ANSWER_EMPTY"
ANSWER_TOO_LONG = "ANSWER_TOO_LONG"
EVIDENCE_MISSING = "EVIDENCE_MISSING"
EVIDENCE_NOT_IN_TOOL_RESULT = "EVIDENCE_NOT_IN_TOOL_RESULT"
MARKER_MISMATCH = "MARKER_MISMATCH"
NUMBER_NOT_IN_TOOL_RESULT = "NUMBER_NOT_IN_TOOL_RESULT"
CAUSAL_NOT_IN_SOURCE = "CAUSAL_NOT_IN_SOURCE"
GRADE_CHANGED = "GRADE_CHANGED"
BLOCKED_EXPRESSION = "BLOCKED_EXPRESSION"
ACTION_INVALID = "ACTION_INVALID"
NOT_FOUND_AFTER_TOOL_FAILURE = "NOT_FOUND_AFTER_TOOL_FAILURE"

_MARKER = re.compile(r"\[([^\[\]\n]+)\]")
# 회사가 직접 밝힌 설명(STATED)의 꼴. 등급이 RELATED·NONE인 결과를 이렇게 쓰면 등급을 바꾼 것이다
_STATED_FORM = re.compile(r"밝혔|밝히고|설명했|설명하고|라고\s*(?:공시|했|적)")


@dataclass(frozen=True)
class Draft:
    """형식 검사를 통과한 답 초안(내용 검사 전)."""

    status: str
    answer: str | None
    evidence_ids: list[str]
    actions: list[dict[str, Any]]


@dataclass(frozen=True)
class Reviewed:
    """final은 통과했을 때만 있다. 아니면 problems(LLM에 알려 줄 문장)와 rules가 있다.

    terminal이면 다시 써도 고칠 수 없는 문제라 바로 '검토 필요'로 끝낸다.
    """

    final: FinalAnswer | None
    problems: list[str] = field(default_factory=list)
    rules: list[str] = field(default_factory=list)
    blocked_rules: list[str] = field(default_factory=list)
    terminal: bool = False


def parse_plan(data: Any, step: StepInput) -> list[ToolCall]:
    """다음에 부를 Tool. 자료가 충분해 답하기로 했으면 빈 목록이다."""
    if not isinstance(data, dict) or data.get("decision") not in DECISIONS:
        raise OutputProblem(["decision이 CALL_TOOLS·ANSWER 중 하나인 JSON 객체가 필요합니다."])
    if data["decision"] == ANSWER:
        return []
    calls = data.get("toolCalls")
    if not isinstance(calls, list) or not 1 <= len(calls) <= MAX_TOOL_CALLS:
        raise OutputProblem([f"CALL_TOOLS이면 toolCalls에 1~{MAX_TOOL_CALLS}개를 적으세요."])
    problems: list[str] = []
    parsed: list[ToolCall] = []
    for index, call in enumerate(calls):
        name = call.get("name") if isinstance(call, dict) else None
        spec = step.tool(name) if isinstance(name, str) else None
        if spec is None:
            problems.append(f"주어진 Tool이 아닙니다: {name!r}")
            continue
        arguments = call.get("arguments", {})
        problem = schema_problem(arguments, spec.parameters)
        if problem:
            problems.append(f"{spec.name}의 arguments가 맞지 않습니다: {problem}")
            continue
        parsed.append(ToolCall(f"c{len(step.tool_results) + index + 1}", spec.name, arguments))
    if problems:
        raise OutputProblem(problems)
    return parsed


def parse_draft(data: Any) -> Draft:
    if not isinstance(data, dict):
        raise OutputProblem(["status·answer·evidenceIds·actions가 있는 JSON 객체가 필요합니다."])
    status = data.get("status")
    if status not in LLM_STATUSES:
        raise OutputProblem(["status는 ANSWERED·NOT_FOUND 중 하나여야 합니다."])
    answer = data.get("answer")
    if answer is not None and not isinstance(answer, str):
        raise OutputProblem(["answer는 문자열이거나 null이어야 합니다."])
    evidence = _strings(data.get("evidenceIds"))
    if evidence is None:
        raise OutputProblem(["evidenceIds는 문자열 배열이어야 합니다."])
    actions = data.get("actions") or []
    if not isinstance(actions, list) or not all(isinstance(a, dict) for a in actions):
        raise OutputProblem(["actions는 객체 배열이어야 합니다."])
    return Draft(status, answer, evidence, actions)


def review(draft: Draft, step: StepInput) -> Reviewed:
    action_problem = _actions_problem(draft.actions, step)
    if action_problem:
        return Reviewed(None, [action_problem], [ACTION_INVALID])
    if draft.status == NOT_FOUND:
        if step.all_tools_failed():
            return Reviewed(
                None,
                ["실행한 Tool이 모두 실패해 자료가 없는지 알 수 없습니다."],
                [NOT_FOUND_AFTER_TOOL_FAILURE],
                terminal=True,
            )
        return Reviewed(FinalAnswer(NOT_FOUND, actions=draft.actions))
    rule, problem = _answer_problem(draft, step)
    if problem:
        return Reviewed(None, [problem], [rule])
    assert draft.answer is not None
    findings = scan(without_markers(draft.answer))
    if findings:
        labels = ", ".join(dict.fromkeys(f.label for f in findings))
        quoted = ", ".join(f"'{f.matched}'" for f in findings[:3])
        return Reviewed(
            None,
            [
                f"투자 권유로 읽힐 수 있는 표현이 있습니다({labels}: {quoted}). "
                "Tool 결과에 적힌 사실만 중립적으로 쓰세요."
            ],
            [BLOCKED_EXPRESSION],
            sorted({f.rule_id for f in findings}),
        )
    return Reviewed(FinalAnswer(ANSWERED, draft.answer.strip(), draft.evidence_ids, draft.actions))


def without_markers(answer: str) -> str:
    """근거 표시(접수번호의 숫자 포함)를 뺀 본문. 숫자·표현 검사는 본문으로 한다."""
    return _MARKER.sub("", answer)


def schema_problem(value: Any, schema: dict[str, Any]) -> str | None:
    """값이 받은 JSON Schema에 맞는지(jsonschema, Draft 2020-12). 맞으면 None, 아니면 첫 문제.

    실제 제공자는 엄격한 구조화 출력으로 같은 스키마를 지키지만, 가짜 제공자와 형식이 깨진
    응답을 막으려고 코드로도 확인한다. 엄격 모드는 필수가 아닌 필드를 null로 채우므로
    (app.llm.providers.strict_schema), 필수가 아닌 필드의 null은 없는 것으로 보고 검사한다.
    필수 필드의 null은 타입이 틀린 것으로 걸린다.
    """
    errors = sorted(
        Draft202012Validator(schema).iter_errors(_drop_optional_nulls(value, schema)),
        key=lambda e: list(e.absolute_path),
    )
    if not errors:
        return None
    error = errors[0]
    where = ".".join(str(p) for p in error.absolute_path) or "(전체)"
    return f"{where}: {error.message}"


def schema_error(schema: dict[str, Any]) -> str | None:
    """받은 parameters가 올바른 JSON Schema(object)인지. 요청을 받을 때 확인한다."""
    if schema.get("type") != "object":
        return "type이 object여야 합니다."
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as e:
        return e.message
    return None


def _drop_optional_nulls(value: Any, schema: Any) -> Any:
    if not isinstance(schema, dict):
        return value
    if isinstance(value, dict):
        properties = schema.get("properties") or {}
        required = set(schema.get("required") or [])
        return {
            key: _drop_optional_nulls(item, properties.get(key))
            for key, item in value.items()
            if item is not None or key in required
        }
    if isinstance(value, list) and isinstance(schema.get("items"), dict):
        return [_drop_optional_nulls(item, schema["items"]) for item in value]
    return value


def _strings(value: Any) -> list[str] | None:
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        return None
    return list(dict.fromkeys(value))


def _actions_problem(actions: list[dict[str, Any]], step: StepInput) -> str | None:
    for action in actions:
        action_type = action.get("type")
        spec = step.action(action_type) if isinstance(action_type, str) else None
        if spec is None:
            return f"주어진 액션 종류가 아닙니다: {action.get('type')!r}"
        fields = {k: v for k, v in action.items() if k != "type"}
        problem = schema_problem(fields, spec.parameters)
        if problem:
            return f"{spec.type} 액션의 값이 맞지 않습니다: {problem}"
    return None


def _answer_problem(draft: Draft, step: StepInput) -> tuple[str, str | None]:
    answer = draft.answer
    if not answer or not answer.strip():
        return ANSWER_EMPTY, "ANSWERED이면 answer에 문장이 있어야 합니다(답할 수 없으면 NOT_FOUND)."
    if len(answer) > MAX_ANSWER:
        return ANSWER_TOO_LONG, f"answer가 {MAX_ANSWER}자를 넘습니다."
    evidence = step.evidence()
    if not draft.evidence_ids:
        return EVIDENCE_MISSING, "근거가 없습니다. evidenceIds에 Tool 결과의 근거 ID를 적으세요."
    unknown = [e for e in draft.evidence_ids if e not in evidence]
    if unknown:
        return EVIDENCE_NOT_IN_TOOL_RESULT, f"Tool 결과에 없는 근거 ID입니다: {unknown[:3]}"
    markers = list(dict.fromkeys(_MARKER.findall(answer)))
    not_listed = [m for m in markers if m not in draft.evidence_ids]
    not_marked = [e for e in draft.evidence_ids if e not in markers]
    if not_listed or not_marked:
        return MARKER_MISMATCH, (
            "답의 근거 표시 [id]와 evidenceIds가 같아야 합니다"
            f"(표시만 있음: {not_listed[:3]}, 표시 없음: {not_marked[:3]})."
        )
    body = without_markers(answer)
    texts = {e: evidence[e].text for e in draft.evidence_ids}
    problem = number_problem(body, texts, draft.evidence_ids)
    if problem:
        return NUMBER_NOT_IN_TOOL_RESULT, problem
    cited = [evidence[e] for e in draft.evidence_ids]
    claim = find_causal(body)
    if claim and not any(
        find_causal(item.text) and item.grade in (None, GRADE_STATED) for item in cited
    ):
        return CAUSAL_NOT_IN_SOURCE, (
            f"원인 표현('{claim}')은 인용한 자료가 원인을 직접 밝혔을 때만 씁니다. "
            "자료에 적힌 내용만 원인 없이 쓰세요."
        )
    graded = [item for item in cited if item.grade]
    stated_form = _STATED_FORM.search(body)
    if stated_form and graded and not any(item.grade == GRADE_STATED for item in graded):
        return GRADE_CHANGED, (
            f"'{stated_form.group(0)}'처럼 회사가 직접 설명한 것으로 쓰려면 인용한 설명의 등급이 "
            "STATED여야 합니다. RELATED는 '관련 공시 내용', NONE은 '확인된 설명 없음'으로 쓰세요."
        )
    return "", None
