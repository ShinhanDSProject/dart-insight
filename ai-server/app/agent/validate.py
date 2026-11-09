"""에이전트 결과 검사(ADR-0045). 코드가 확인한다.

- parse_plan: 다음 Tool 고르기 결과의 형식(받은 목록의 Tool, 인자 형식, 한 번에 3개까지)
- parse_draft: 답 초안의 형식. 형식이 틀리면 LlmClient가 다시 생성한다
- review: 검토 노드의 내용 검사. 반려하면 사유(규칙 ID)를 붙여 다시 쓰게 한다
  - 근거 ID가 실행에 성공한 Tool 결과에 있음, 답의 근거 표시와 evidenceIds가 같음
  - 숫자·크기 표현이 그 문장이 인용한 Tool 결과에 있음(app.llm.grounding)
  - 원인 표현은 그 문장이 인용한 결과에도 원인 표현이 있고, 등급이 있으면 STATED일 때만(ADR-0015)
  - '회사가 밝혔다' 같은 직접 설명 꼴은 그 문장이 인용한 결과의 등급이 STATED일 때만
    (등급을 바꾸지 않음). 원인·등급은 문장마다 그 문장 끝의 근거 표시로 본다
  - 용어 카드(G)만 인용한 문장은 회사 이름·'이 회사' 같은 회사 지칭을 쓰지 않음(ADR-0061).
    용어 풀이 Workflow의 보고서 설명 풀이 검사는 workflow.term_answer_problem이 extra로 더한다
  - 투자 권유성 표현 검사(app.compliance) 통과. 걸리면 규칙 ID를 blocked_rules에 남긴다
  - 액션은 받은 목록의 종류와 형식(JSON Schema)만. 값이 이 분석에 실제로 있는지는 backend가
    확인하고 없으면 그 액션을 뺀다(ADR-0044, docs/api-spec.md `final.actions`)
  - Tool을 모두 실패했는데 NOT_FOUND면 다시 써도 고칠 수 없으므로 바로 '검토 필요'
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from app.agent.answer_format import answer_format, max_answer, requested_lines
from app.agent.model import (
    ANSWERED,
    FORMAT_BRIEF,
    LLM_STATUSES,
    MAX_TOOL_CALLS,
    NOT_FOUND,
    FinalAnswer,
    ResultItem,
    StepInput,
    ToolCall,
)
from app.compliance import scan
from app.llm import OutputProblem
from app.llm.grounding import number_problem
from app.summary.causal import find as find_causal

# 다음 Tool 고르기 결과(decision)
CALL_TOOLS = "CALL_TOOLS"
ANSWER = "ANSWER"
DECISIONS = (CALL_TOOLS, ANSWER)

# 재무 설명 등급(ADR-0015)
GRADE_STATED = "STATED"

# 검토 노드가 반려한 규칙(응답 rejections[].rules)
ANSWER_EMPTY = "ANSWER_EMPTY"
ANSWER_TOO_LONG = "ANSWER_TOO_LONG"
BRIEF_LINE_WITHOUT_EVIDENCE = "BRIEF_LINE_WITHOUT_EVIDENCE"
BRIEF_FORMAT = "BRIEF_FORMAT"
BRIEF_LINE_COUNT = "BRIEF_LINE_COUNT"
BRIEF_DUPLICATE_LINE = "BRIEF_DUPLICATE_LINE"
# 정리 형식 줄의 머리와, 줄 끝 근거 표시(뒤 공백만 허용)
BRIEF_BULLET = "- "
_ENDS_WITH_MARKER = re.compile(r"\[[^\[\]\n]+\]\s*$")
EVIDENCE_MISSING = "EVIDENCE_MISSING"
EVIDENCE_NOT_IN_TOOL_RESULT = "EVIDENCE_NOT_IN_TOOL_RESULT"
MARKER_MISMATCH = "MARKER_MISMATCH"
NUMBER_NOT_IN_TOOL_RESULT = "NUMBER_NOT_IN_TOOL_RESULT"
CAUSAL_NOT_IN_SOURCE = "CAUSAL_NOT_IN_SOURCE"
GRADE_CHANGED = "GRADE_CHANGED"
BLOCKED_EXPRESSION = "BLOCKED_EXPRESSION"
ACTION_INVALID = "ACTION_INVALID"
NOT_FOUND_AFTER_TOOL_FAILURE = "NOT_FOUND_AFTER_TOOL_FAILURE"
# 용어 카드(ADR-0061): 카드(G)만 인용한 문장이 회사를 가리킴 / 보고서 설명 풀이가 인용 밖 내용을 씀
GLOSSARY_COMPANY_REFERENCE = "GLOSSARY_COMPANY_REFERENCE"
REPORT_EXPLANATION_UNSUPPORTED = "REPORT_EXPLANATION_UNSUPPORTED"
# 용어 카드 근거 ID(G{카드 키}, 키는 영문 소문자로 시작하는 카멜 표기)
_GLOSSARY_ID = re.compile(r"^G[a-z][A-Za-z0-9]*$")
# 회사를 가리키는 말. '회사채'처럼 용어 안의 '회사'는 회사를 가리키지 않으므로 넣지 않는다
_COMPANY_WORDS = re.compile(r"이\s*회사|이\s*기업|당사|해당\s*회사|해당\s*기업")

_MARKER = re.compile(r"\[([^\[\]\n]+)\]")
# 회사가 직접 밝힌 설명(STATED)의 꼴. 등급이 RELATED·NONE인 결과를 이렇게 쓰면 등급을 바꾼 것이다
_STATED_FORM = re.compile(r"밝혔|밝히고|설명했|설명하고|라고\s*(?:공시|했|적)")
# 문장 끝: 마침표·물음표·느낌표와 그 뒤 근거 표시, 그다음 공백이나 글 끝.
# '6.6조'의 점은 뒤에 공백이 없어 끊지 않는다
_SENTENCE_END = re.compile(r"[.!?](?:\s*\[[^\[\]\n]+\])*(?=\s|$)")
# 마침표 앞 낱말이 목차 번호(로마 숫자 'XI', 한두 자리 숫자 '1')나 약어('Inc')면 문장 끝이 아니다.
# '2026.'처럼 그 밖의 숫자·영문 뒤 마침표와 물음표·느낌표는 문장 끝이다
_NOT_SENTENCE_END = re.compile(r"(?:^|[\s(\[‘'\"“])(?:[IVXL]+|\d{1,2}|Inc|Co|Ltd|Corp|No|vs|etc)$")


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
    """다음에 부를 Tool. 자료가 충분해 답하기로 했거나 Workflow만 골랐으면 빈 목록이다."""
    if not isinstance(data, dict) or data.get("decision") not in DECISIONS:
        raise OutputProblem(["decision이 CALL_TOOLS·ANSWER 중 하나인 JSON 객체가 필요합니다."])
    if data["decision"] == ANSWER:
        return []
    calls = data.get("toolCalls")
    if isinstance(data.get("workflow"), dict) and calls == []:
        # Workflow를 고르면 Tool 순서는 코드가 정한다(app.agent.workflow)
        return []
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


def plan_draft(data: Any) -> Draft | None:
    """Tool 고르기가 자료가 충분하다며(ANSWER) 함께 쓴 답 초안(ADR-0049).

    CALL_TOOLS이거나 초안이 없거나 형식이 틀리면 None이다. 그때는 답 쓰기 노드가 답을 쓴다
    (초안 형식 오류로 고르기를 다시 부르지 않는다).
    """
    if not isinstance(data, dict) or data.get("decision") != ANSWER:
        return None
    try:
        return parse_draft(data.get("draft"))
    except OutputProblem:
        return None


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


def review(
    draft: Draft,
    step: StepInput,
    extra: Callable[[str, StepInput], tuple[str, str] | None] | None = None,
) -> Reviewed:
    """extra는 Workflow가 더하는 내용 검사(규칙 ID, 사유). 공통 검사를 통과한 답에만 부른다."""
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
    extra_problem = extra(draft.answer, step) if extra is not None else None
    if extra_problem is not None:
        return Reviewed(None, [extra_problem[1]], [extra_problem[0]])
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
    return Reviewed(
        FinalAnswer(
            ANSWERED,
            draft.answer.strip(),
            draft.evidence_ids,
            draft.actions,
            format=answer_format(step.message),
        )
    )


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
            if item is not None or key in required or key not in properties
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
    fmt = answer_format(step.message)
    limit = max_answer(fmt)
    if len(answer) > limit:
        return ANSWER_TOO_LONG, f"answer가 {limit}자를 넘습니다."
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
    if fmt == FORMAT_BRIEF:
        return _brief_problem(answer, step, evidence)
    for sentence in _sentences(answer):
        rule, problem = _sentence_problem(sentence, evidence)
        if problem:
            return rule, problem
        rule, problem = _glossary_problem(sentence, evidence, step.company_name)
        if problem:
            return rule, problem
    return "", None


def _glossary_problem(
    sentence: str, evidence: dict[str, ResultItem], company_name: str
) -> tuple[str, str | None]:
    """용어 카드(G)만 인용한 문장은 회사를 가리키지 않는다(ADR-0061).

    카드는 용어의 뜻과 가정한 예시의 근거일 뿐 회사 사실의 근거가 아니다. 숫자는 인용한 줄에 있는
    것만 쓰는 검사(number_problem)로 이미 카드 예시의 숫자만 쓸 수 있다.
    """
    markers = [m for m in dict.fromkeys(_MARKER.findall(sentence)) if m in evidence]
    if not markers or not all(_GLOSSARY_ID.match(m) for m in markers):
        return "", None
    body = without_markers(sentence)
    named = company_name and re.sub(r"\s+", "", company_name) in re.sub(r"\s+", "", body)
    if named or _COMPANY_WORDS.search(body):
        return GLOSSARY_COMPANY_REFERENCE, (
            "용어 카드만 인용한 문장에는 회사 이름이나 '이 회사' 같은 회사 지칭을 쓰지 않습니다. "
            "회사의 값·문장은 회사 근거(F·T·#B·#V 등)를 인용한 문장으로 따로 쓰세요."
        )
    return "", None


def split_sentences(answer: str) -> list[str]:
    """답을 문장으로 나눈다(근거 표시는 앞 문장에 붙음). 검토 규칙이 문장마다 볼 때 쓴다."""
    return _sentences(answer)


def _brief_problem(
    answer: str, step: StepInput, evidence: dict[str, ResultItem]
) -> tuple[str, str | None]:
    """정리 형식(BRIEF): 줄 단위로 꼴·줄 수를 보고, 숫자·원인·등급은 그 줄이 인용한 근거로만 본다.

    줄 끝에 마침표가 없어도 줄끼리 한 문장으로 묶이지 않게 문장이 아니라 줄로 나눈다.
    """
    lines = [line.strip() for line in answer.splitlines() if line.strip()]
    bare = [line for line in lines if not _MARKER.search(line)]
    if bare:
        return BRIEF_LINE_WITHOUT_EVIDENCE, (
            f"정리 형식은 줄마다 근거 표시가 있어야 합니다(근거 없는 줄: '{bare[0][:40]}')."
        )
    malformed = [
        line
        for line in lines
        if not line.startswith(BRIEF_BULLET) or not _ENDS_WITH_MARKER.search(line)
    ]
    if malformed:
        return BRIEF_FORMAT, (
            "정리 형식은 줄마다 '- '로 시작하고 줄 끝에 근거 표시를 붙여야 합니다"
            f"(맞지 않는 줄: '{malformed[0][:40]}')."
        )
    bodies = [_compact(without_markers(line)[len(BRIEF_BULLET) :]) for line in lines]
    if len(set(bodies)) < len(bodies):
        # 같은 줄을 되풀이해 줄 수를 채우지 않게 한다. 보장 범위는 글자 반복뿐이다: 근거 표시·공백·
        # 문장부호만 무시하고 비교하므로, 조사·어미만 바꾼 같은 사실('영업이익은 감소했어요'·
        # '영업이익 감소가 확인됐어요')은 잡지 않는다. 뜻이 같은지는 코드로 안정적으로 가릴 수 없고,
        # 이 검사에 LLM 판정을 더하지 않는다(ADR-0045 검토 노드는 코드 규칙)
        return (
            BRIEF_DUPLICATE_LINE,
            "정리 형식에 같은 내용의 줄이 있습니다. 줄마다 다른 내용을 쓰세요.",
        )
    requested = requested_lines(step.message)
    # 줄 수는 근거 ID 수로 정하지 않는다(근거 하나에 사실이 여럿일 수 있음). 지어낸 줄은 줄마다
    # 근거·숫자 검사와 같은 내용 되풀이 검사로 막는다
    if requested is not None and len(lines) != requested:
        return BRIEF_LINE_COUNT, (
            f"사용자가 {requested}줄을 요청했습니다. {requested}줄로 쓰세요. "
            "같은 내용을 되풀이하거나 Tool 결과에 없는 내용으로 줄을 채우지 마세요."
        )
    for line in lines:
        rule, problem = _sentence_problem(line, evidence)
        if problem:
            return rule, problem
    return "", None


def _compact(text: str) -> str:
    """되풀이 비교용: 공백·문장부호를 빼되 숫자의 부호('-1')와 소수점('1.2')은 남긴다."""
    return re.sub(r"""[\s,!?·'"~]+|-(?!\d)|(?<!\d)\.|\.(?!\d)""", "", text)


def _sentences(answer: str) -> list[str]:
    sentences: list[str] = []
    start = 0
    for end in _SENTENCE_END.finditer(answer):
        # 근거 표시가 붙은 마침표는 목차 번호 뒤라도 문장 끝이다
        if end.group(0) == "." and _NOT_SENTENCE_END.search(answer[start : end.start()]):
            continue
        sentences.append(answer[start : end.end()])
        start = end.end()
    sentences.append(answer[start:])
    return [s.strip() for s in sentences if s.strip()]


def _sentence_problem(sentence: str, evidence: dict[str, ResultItem]) -> tuple[str, str | None]:
    """한 문장의 숫자·원인 표현·직접 설명 꼴이 그 문장이 인용한 근거에 맞는지(ADR-0015).

    다른 문장의 근거에 있는 숫자나 STATED 등급으로 이 문장을 통과시키지 않는다.
    """
    body = without_markers(sentence)
    markers = [m for m in dict.fromkeys(_MARKER.findall(sentence)) if m in evidence]
    problem = number_problem(body, {m: evidence[m].text for m in markers}, markers)
    if problem:
        return NUMBER_NOT_IN_TOOL_RESULT, problem
    cited = [evidence[m] for m in markers]
    claim = find_causal(body)
    if claim and not any(
        find_causal(item.text) and item.grade in (None, GRADE_STATED) for item in cited
    ):
        return CAUSAL_NOT_IN_SOURCE, (
            f"원인 표현('{claim}')은 그 문장이 인용한 자료가 원인을 직접 밝혔을 때만 씁니다. "
            "자료에 적힌 내용만 원인 없이 쓰세요."
        )
    graded = [item for item in cited if item.grade]
    stated_form = _STATED_FORM.search(body)
    if stated_form and graded and not any(item.grade == GRADE_STATED for item in graded):
        return GRADE_CHANGED, (
            f"'{stated_form.group(0)}'처럼 회사가 직접 설명한 것으로 쓰려면 그 문장이 인용한 "
            "설명의 등급이 STATED여야 합니다. RELATED는 '관련 공시 내용', NONE은 "
            "'확인된 설명 없음'으로 쓰세요."
        )
    return "", None
