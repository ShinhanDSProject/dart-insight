"""정해진 Tool 순서로 처리하는 요청(ADR-0045 workflow_step, #581).

- 원인 추적(CAUSE_TRACE): get_financial_changes·get_summary → (회사 설명 인용이 없으면)
  search_text_changes. 저장된 설명 등급·인용을 그대로 쓰고, 새로 찾은 문장은 등급 없이
  '관련 문장'이다.
- 교차 검증(CROSS_CHECK): get_financial_changes·get_summary·(있으면) get_plan_followups.
  crossCheck.result는 cross_check()가 정하고 LLM은 바꾸지 못한다
  (docs/api-spec.md 3절 '교차 검증 판정').
- 용어 풀이(TERM, ADR-0061): lookup_terms → 카드가 있으면 카드의 '이 회사 값을 찾을 곳'
  (재무 계정이면 get_financial_changes, 아니면 체크포인트 get_checkpoints)과 문장 변경
  search_text_changes(q=용어), 카드가 없으면 answer_with_evidence(질문=용어). 카드도 보고서
  설명도 없으면 LLM 없이 정해진 안내(term_fixed_final)로 끝낸다. 카드는 사람이 검토한 것이라
  정의를 LLM이 만들지 않는다.

어느 Workflow를 쓸지는 첫 Tool 고르기에서 LLM이 고르고, 그 뒤 Tool 순서는 이 모듈이 정한다.
한 단계는 상태를 들고 있지 않으므로 Workflow로 부른 Tool은 callId 머리(cause-·cross-·term-)로
알아본다.
받은 tools에 필요한 Tool이 없으면 Workflow를 쓰지 않고 일반 경로로 간다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.agent.model import (
    ANSWERED,
    MAX_TOOL_CALLS,
    CrossCheck,
    FinalAnswer,
    ResultItem,
    StepInput,
    ToolCall,
    ToolResult,
)
from app.agent.validate import (
    EASIER_ANSWER_TOO_LONG,
    REPORT_EXPLANATION_UNSUPPORTED,
    schema_problem,
    split_sentences,
    without_markers,
)
from app.compliance import scan
from app.llm.client import OutputProblem

CAUSE_TRACE = "CAUSE_TRACE"
CROSS_CHECK = "CROSS_CHECK"
TERM = "TERM"
WORKFLOWS = (CAUSE_TRACE, CROSS_CHECK, TERM)

FINANCIAL_CHANGES = "get_financial_changes"
SUMMARY = "get_summary"
SEARCH_TEXT_CHANGES = "search_text_changes"
PLAN_FOLLOWUPS = "get_plan_followups"
LOOKUP_TERMS = "lookup_terms"
CHECKPOINTS = "get_checkpoints"
ANSWER_WITH_EVIDENCE = "answer_with_evidence"
OPEN_GLOSSARY = "OPEN_GLOSSARY"

# 없으면 그 Workflow를 쓰지 않는 Tool
REQUIRED_TOOLS = {
    CAUSE_TRACE: (FINANCIAL_CHANGES, SUMMARY),
    CROSS_CHECK: (FINANCIAL_CHANGES, SUMMARY),
    TERM: (LOOKUP_TERMS,),
}
_CALL_PREFIX = {CAUSE_TRACE: "cause-", CROSS_CHECK: "cross-", TERM: "term-"}

# 용어 풀이(ADR-0061). lookup_terms 줄 글의 모양은 backend agent/domain/TermLines와의 약속이다
# (docs/api-spec.md 3절 Tool 목록). 바꾸면 양쪽을 함께 고친다
MAX_TERMS = 3
_TERM_SPLIT = re.compile(r"\s*[,·/]\s*")
_CARD_HEAD = re.compile(
    r"^\[용어 카드 (?P<term>.+?), (?P<level>기초|핵심) 카드, 키 (?P<key>[A-Za-z0-9]+)\]"
)
_CARD_ACCOUNTS = re.compile(r"재무 계정 (?P<accounts>[^(]+)\(get_financial_changes")
_CARD_CHECKPOINT = re.compile(r"체크 포인트 [A-Z_]+\(get_checkpoints")
_MISSING_HEAD = re.compile(
    r"^\[용어 카드 없음\] '(?P<query>.+?)'에 해당하는 용어 카드는 등록되지 않았어요\."
)
_SIMILAR = re.compile(r"비슷한 카드: (?P<cards>.+)$")
_SIMILAR_CARD = re.compile(r"(?P<term>.+?)\((?P<key>[A-Za-z0-9]+)\)$")
# 비슷한 카드가 없을 때 다음에 물을 것으로 보여 주는 기초 카드
BASIC_TERMS = ("자산", "매출", "주식")
# 보고서 설명 인용으로 보는 근거(원문 문단)
_BLOCK = "#B"
_QUOTE_BODY = re.compile(r"^\[[^\[\]\n]*\]\s*(?:[^:\n]*?:\s)?")
# 인용 글의 문장(인용이 문단 앞 160자라 마지막 문장은 마침표 없이 끝날 수 있다)
_QUOTE_SENTENCE = re.compile(r"[^.!?\n]+(?:[.!?]|$)")

TERM_NOT_FOUND = "{terms}에 해당하는 용어 카드가 없고, 이 보고서에서도 설명을 찾지 못했어요."
# 일반 설명(ADR-0064): 코드가 붙이는 첫·끝 문장과 검사 상한.
# 첫 문장 + 3문장 + 끝 문장이 대화 답 400자 안에 들게
GENERAL_LEAD = (
    "'{term}'{topic} 등록된 용어 카드가 없고 이 보고서에서도 설명을 찾지 못해, "
    "일반적인 뜻을 AI가 풀었어요."
)
GENERAL_TAIL = "공시 근거가 아닌 일반 설명이라 틀릴 수 있어요."
MAX_GENERAL_SENTENCES = 3
MAX_GENERAL_CHARS = 100
EXAMPLE_LEAD = "예를 들어"
_DIGIT = re.compile(r"\d")
# 회사 이름 뒤에 붙을 수 있는 조사
_PARTICLES = "은|는|이|가|을|를|의|에|에서|도|와|과|로|으로|만"
_COMPANY_REFERENCE = re.compile(r"이\s*회사|이\s*기업|당사|해당\s*회사|해당\s*기업")
REPORT_QUOTE = "이 회사 보고서에 적힌 설명이에요."
# 보고서 설명 풀이 문장의 내용 낱말(두 글자 이상)과, 내용으로 보지 않는 틀 낱말
_CONTENT_WORD = re.compile(r"[가-힣A-Za-z0-9]{2,}")
# '더 쉽게' 요청(#823). 화면 버튼은 '{용어} 더 쉽게 설명해줘'를 보낸다. 공백을 빼고 찾는다
_EASIER_REQUEST = re.compile(r"더쉽게|쉽게설명|쉽게풀어|쉬운말로")
# '더 쉽게' 답의 문장 수 상한(쉬운 뜻 한 문장 + 예시 한 문장 + 이 회사 값 한 문장)
MAX_EASIER_SENTENCES = 3


def easier_request(step: StepInput) -> bool:
    """사용자가 앞 용어 풀이를 더 쉽게 다시 해 달라고 했는지."""
    return _EASIER_REQUEST.search(re.sub(r"\s+", "", step.message)) is not None
_FRAME_WORDS = frozenset(
    {
        "쉽게",
        "말하면",
        "말해",
        "회사",
        "회사가",
        "회사는",
        "회사의",
        "보고서",
        "보고서에",
        "보고서는",
        "설명",
        "설명이에요",
        "설명해요",
        "적힌",
        "적혀",
        "의미",
        "의미예요",
        "의미해요",
        "이에요",
        "예요",
        "이는",
        "이것은",
        "이란",
        "이라는",
        "라는",
        "즉",
        "다시",
        "정리하면",
        "있어요",
        "있다는",
        "거예요",
        "것이에요",
        "뜻이에요",
        "뜻해요",
        "말이에요",
    }
)
# 화면에서 고른 변경을 첫 왕복 전에 넣은 결과(backend). Workflow 시작을 막지 않는다
_CONTEXT_PREFIX = "ctx-"

# 교차 검증 결과(공개 API crossCheck.result)
CONSISTENT = "CONSISTENT"
POTENTIAL_MISMATCH = "POTENTIAL_MISMATCH"
INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
NOT_COMPARABLE = "NOT_COMPARABLE"

UP = "UP"
DOWN = "DOWN"
# 방향을 대조하는 계정의 계산 상태. 손실 계정(LOSS_NARROWED·LOSS_WIDENED·PREVIOUS_NEGATIVE·
# SIGN_CHANGED)은 '손실 감소'처럼 말과 금액의 방향이 거꾸로 읽힐 수 있어 대조하지 않는다
COMPARED_STATUSES = frozenset({"OK", "PREVIOUS_ZERO", "TURNED_PROFIT", "TURNED_LOSS"})
# 기준이 달라 대조하지 않는 계정
NOT_COMPARABLE_STATUSES = frozenset(
    {
        "PERIOD_MISMATCH",
        "AMBIGUOUS_MATCH",
        "ONLY_CURRENT",
        "ONLY_PREVIOUS",
        "PREVIOUS_MISSING",
        "CURRENT_MISSING",
    }
)
# 회사 설명 인용으로 보는 등급(ADR-0015)
EXPLANATION_GRADES = frozenset({"STATED", "RELATED"})

# 설명 방향 낱말. '개선'·'악화' 같은 가치판단 낱말은 넣지 않는다
_UP_WORDS = re.compile(r"증가|늘|확대|상승|성장")
_DOWN_WORDS = re.compile(r"감소|줄|축소|하락|감축")
# 줄 글 앞의 머리말([요약 인용, 등급 RELATED] 등)
_HEAD = re.compile(r"^\[[^\[\]\n]*\]\s*")

NOT_COMPARABLE_REASON = "대조할 계정이 모두 기간·계정 짝 같은 기준이 달라 대조하지 않았어요."
INSUFFICIENT_REASON = "재무 수치와 방향을 대조할 수 있는 회사 설명 인용이 없어요."


@dataclass(frozen=True)
class Choice:
    """첫 Tool 고르기가 고른 Workflow.

    account는 사용자가 말한 계정 이름, terms는 TERM에서 풀 용어(최대 3개)다. 없으면 None·빈 값.
    """

    workflow: str
    account: str | None = None
    terms: tuple[str, ...] = ()


def available(step: StepInput) -> list[str]:
    """받은 tools로 쓸 수 있는 Workflow."""
    return [w for w in WORKFLOWS if all(step.tool(name) for name in REQUIRED_TOOLS[w])]


def can_start(step: StepInput) -> bool:
    """Workflow는 첫 Tool 고르기에서만 시작한다(화면에서 고른 변경 결과는 세지 않음)."""
    return not any(not r.call_id.startswith(_CONTEXT_PREFIX) for r in step.tool_results)


def choice(data: Any, step: StepInput) -> Choice | None:
    """Tool 고르기 출력의 workflow. 고르지 않았거나 지금 쓸 수 없으면 None이다."""
    if not isinstance(data, dict) or not isinstance(data.get("workflow"), dict):
        return None
    workflow = data["workflow"].get("type")
    if workflow not in available(step) or not can_start(step):
        return None
    account = data["workflow"].get("account")
    account = account.strip() if isinstance(account, str) and account.strip() else None
    terms = _terms(data["workflow"].get("term"))
    if workflow == TERM and not terms:
        # 풀 용어를 모르면 용어 풀이를 시작하지 않는다
        return None
    return Choice(workflow, account, terms)


def implied_choice(calls: list[ToolCall], step: StepInput) -> Choice | None:
    """첫 고르기가 workflow를 적지 않고 lookup_terms 하나만 불렀으면 용어 풀이로 본다(ADR-0061).

    Tool 고르기는 스키마가 커서 구조화 출력 없이 부를 수 있어(ADR-0062) workflow 칸이 빠지기도 한다.
    용어 카드를 찾는 요청의 다음 순서는 늘 같으므로 코드가 Workflow로 이어 간다.
    """
    if len(calls) != 1 or calls[0].name != LOOKUP_TERMS:
        return None
    if TERM not in available(step) or not can_start(step):
        return None
    raw = calls[0].arguments.get("terms")
    terms = (
        tuple(t for t in raw if isinstance(t, str) and t.strip()) if isinstance(raw, list) else ()
    )
    return Choice(TERM, None, terms[:MAX_TERMS]) if terms else None


def _terms(value: Any) -> tuple[str, ...]:
    """'부채비율, 유동비율'처럼 쉼표·가운뎃점으로 이은 용어(같은 것은 한 번, 최대 MAX_TERMS개)."""
    if not isinstance(value, str):
        return ()
    terms = [t.strip() for t in _TERM_SPLIT.split(value) if t.strip()]
    return tuple(dict.fromkeys(terms))[:MAX_TERMS]


def active(step: StepInput) -> str | None:
    """지금 진행 중인 Workflow(앞서 Workflow로 부른 Tool 결과가 있으면)."""
    for result in step.tool_results:
        for workflow, prefix in _CALL_PREFIX.items():
            if result.call_id.startswith(prefix):
                return workflow
    return None


def start_calls(step: StepInput, chosen: Choice) -> list[ToolCall]:
    """Workflow의 첫 왕복. 서로 기대지 않는 Tool을 한 번에 부른다."""
    if step.remaining_steps <= 0:
        return []
    if chosen.workflow == TERM:
        return _calls(step, TERM, [(LOOKUP_TERMS, {"terms": list(chosen.terms)})])
    financial: dict[str, Any] = {"q": chosen.account} if chosen.account else {}
    if _argument_problem(step, FINANCIAL_CHANGES, financial):
        financial = {}
    wanted: list[tuple[str, dict[str, Any]]] = [(FINANCIAL_CHANGES, financial), (SUMMARY, {})]
    if chosen.workflow == CROSS_CHECK:
        wanted.append((PLAN_FOLLOWUPS, {}))
    return _calls(step, chosen.workflow, wanted)


def next_calls(step: StepInput, workflow: str) -> list[ToolCall]:
    """Workflow의 다음 왕복. 더 부를 Tool이 없으면 빈 목록이고, 그때는 받은 결과로 답한다."""
    if step.remaining_steps <= 0:
        return []
    if workflow == TERM:
        return _term_next_calls(step)
    if workflow != CAUSE_TRACE:
        return []
    if any(r.name == SEARCH_TEXT_CHANGES for r in step.tool_results):
        return []
    # 요약에 다른 계정의 설명 인용만 있으면 이 계정의 설명은 없는 것이다
    asked = {
        item.facts.change_id
        for result in _ok(step, FINANCIAL_CHANGES)
        for item in result.items
        if item.facts is not None and item.facts.change_id is not None
    }
    if asked & _explanation_quotes(step).keys():
        return []
    account = next(
        (
            r.arguments.get("q")
            for r in step.tool_results
            if r.name == FINANCIAL_CHANGES and isinstance(r.arguments.get("q"), str)
        ),
        None,
    )
    # 계정을 모르면 무엇과 관련된 문장인지 정할 수 없어 찾지 않는다
    if not account:
        return []
    return _calls(step, workflow, [(SEARCH_TEXT_CHANGES, {"q": account})])


@dataclass(frozen=True)
class TermCard:
    """lookup_terms가 찾은 카드 한 장(줄 글에서 읽음).

    accounts는 '이 회사 값을 찾을 곳'의 재무 계정, checkpoint는 체크포인트가 있는지다.
    """

    evidence_id: str
    key: str
    term: str
    basic: bool
    accounts: tuple[str, ...]
    checkpoint: bool


@dataclass(frozen=True)
class MissingTerm:
    """카드가 없는 용어와, backend가 고른 비슷한 카드의 용어."""

    query: str
    similar: tuple[str, ...]


def term_cards(step: StepInput) -> list[TermCard]:
    """이 채팅에서 찾은 용어 카드(찾은 순서, 같은 카드는 한 번)."""
    found: dict[str, TermCard] = {}
    for result in _ok(step, LOOKUP_TERMS):
        for item in result.items:
            head = _CARD_HEAD.match(item.text)
            if not item.evidence_id or head is None:
                continue
            accounts = _CARD_ACCOUNTS.search(item.text)
            found.setdefault(
                item.evidence_id,
                TermCard(
                    item.evidence_id,
                    head.group("key"),
                    head.group("term"),
                    head.group("level") == "기초",
                    tuple(a.strip() for a in accounts.group("accounts").split("·") if a.strip())
                    if accounts
                    else (),
                    bool(_CARD_CHECKPOINT.search(item.text)),
                ),
            )
    return list(found.values())


def missing_terms(step: StepInput) -> list[MissingTerm]:
    """카드가 없다고 돌아온 용어(검토 전 카드도 없는 것으로 온다)."""
    missing: list[MissingTerm] = []
    for result in _ok(step, LOOKUP_TERMS):
        for item in result.items:
            head = _MISSING_HEAD.match(item.text)
            if item.evidence_id or head is None:
                continue
            similar = _SIMILAR.search(item.text)
            terms = (
                tuple(
                    m.group("term")
                    for part in similar.group("cards").split(", ")
                    if (m := _SIMILAR_CARD.match(part.strip()))
                )
                if similar
                else ()
            )
            missing.append(MissingTerm(head.group("query"), terms))
    return missing


def _term_next_calls(step: StepInput) -> list[ToolCall]:
    """lookup_terms 다음 한 번만: 카드가 있으면 이 회사 값·문장 변경, 없으면 보고서 설명 찾기."""
    if any(
        r.call_id.startswith(_CALL_PREFIX[TERM]) and r.name != LOOKUP_TERMS
        for r in step.tool_results
    ):
        return []
    cards = term_cards(step)
    wanted: list[tuple[str, dict[str, Any]]] = []
    for card in cards:
        # 이 분석 기간의 값(재무 계정 변화)을 먼저 쓰고, 없을 때만 체크포인트(최근 사업보고서 기준)
        if card.accounts:
            wanted += [(FINANCIAL_CHANGES, {"q": account}) for account in card.accounts]
        elif card.checkpoint:
            wanted.append((CHECKPOINTS, {}))
        wanted.append((SEARCH_TEXT_CHANGES, {"q": card.term}))
    if not cards:
        missing = missing_terms(step)
        if missing:
            wanted.append((ANSWER_WITH_EVIDENCE, {"question": missing[0].query}))
    return _calls(step, TERM, wanted)[:MAX_TOOL_CALLS]


def report_explanation(step: StepInput) -> tuple[str, str] | None:
    """카드가 없을 때 보고서 설명으로 인정하는 인용(근거 ID, 인용 글).

    근거 질문 결과의 원문 문단(#B) 인용이고, 그 인용 글에 용어가 그대로(공백 무시) 있을 때만이다.
    재무 사실(F)만 있거나 인용에 용어가 없으면 None(ADR-0061).
    """
    missing = missing_terms(step)
    if not missing or term_cards(step):
        return None
    term = _compact_term(missing[0].query)
    for result in _ok(step, ANSWER_WITH_EVIDENCE):
        for item in result.items:
            if not item.evidence_id or _BLOCK not in item.evidence_id:
                continue
            quote = _QUOTE_BODY.sub("", item.text, count=1)
            if term and term in _compact_term(quote):
                return item.evidence_id, quote
    return None


def term_fixed_final(step: StepInput) -> FinalAnswer | None:
    """카드도 보고서 설명도 없을 때의 정해진 안내(LLM 없음). 그 밖은 None(LLM이 답함).

    보고서 설명을 찾아본 뒤(근거 질문이 성공했거나 그 Tool이 없을 때)에만 '찾지 못했다'고 한다.
    비슷한 카드마다 용어 사전 열기 버튼(최대 3개), 비슷한 카드가 없으면 기초 카드 버튼을 붙인다.
    """
    missing = missing_terms(step)
    if not missing or term_cards(step) or report_explanation(step) is not None:
        return None
    searched = any(r.ok and r.name == ANSWER_WITH_EVIDENCE for r in step.tool_results)
    if not searched and step.tool(ANSWER_WITH_EVIDENCE) is not None:
        return None
    terms = ", ".join(f"'{m.query}'" for m in missing)
    return FinalAnswer(ANSWERED, TERM_NOT_FOUND.format(terms=terms), [], _glossary_actions(step))


def _glossary_actions(step: StepInput) -> list[dict[str, Any]]:
    """비슷한 카드마다 용어 사전 열기 버튼(최대 3개), 비슷한 카드가 없으면 기초 카드 버튼."""
    if step.action(OPEN_GLOSSARY) is None:
        return []
    similar = list(dict.fromkeys(t for m in missing_terms(step) for t in m.similar))[:MAX_TERMS]
    return [{"type": OPEN_GLOSSARY, "term": t} for t in (similar or BASIC_TERMS)]


def general_term(step: StepInput) -> str | None:
    """정해진 안내 대신 일반 설명(ADR-0064)을 시도할 용어.

    정해진 안내를 낼 자리이고 카드 없는 용어가 하나일 때만(여럿이면 정해진 안내).
    """
    if term_fixed_final(step) is None:
        return None
    missing = missing_terms(step)
    return missing[0].query if len(missing) == 1 else None


def parse_term_general(data: Any, term: str, step: StepInput) -> list[str] | None:
    """일반 설명 출력 검사. 범위 밖(inScope false)이면 None, 고칠 문제가 있으면 OutputProblem.

    1~3문장, 문장마다 MAX_GENERAL_CHARS 이하, 첫 문장에 용어, 회사를 가리키는 말·회사 이름 없음,
    숫자는 '예를 들어' 문장에만, 근거 표시 없음, 투자 권유성 표현 검사 통과.
    """
    if not isinstance(data, dict) or not isinstance(data.get("inScope"), bool):
        raise OutputProblem(["inScope(true/false)와 sentences(문장 목록)로 답합니다."])
    if not data["inScope"]:
        return None
    raw = data.get("sentences")
    items = raw if isinstance(raw, list) else []
    sentences = [x.strip() for x in items if isinstance(x, str) and x.strip()]
    problems: list[str] = []
    if not 1 <= len(sentences) <= MAX_GENERAL_SENTENCES:
        problems.append(f"문장은 1~{MAX_GENERAL_SENTENCES}개입니다.")
    if sentences and _compact_term(term) not in _compact_term(sentences[0]):
        problems.append(f"첫 문장에 용어 '{term}'를 그대로 씁니다.")
    company = _company_name_pattern(step.company_name)
    for sentence in sentences:
        if len(sentence) > MAX_GENERAL_CHARS:
            problems.append(f"문장마다 {MAX_GENERAL_CHARS}자 이하로 씁니다: {sentence[:20]}…")
        if _COMPANY_REFERENCE.search(sentence) or (company and company.search(sentence)):
            problems.append("특정 회사를 가리키지 않습니다('이 회사'·'당사'·회사 이름).")
        if _DIGIT.search(sentence) and not sentence.startswith(EXAMPLE_LEAD):
            problems.append("숫자는 '예를 들어'로 시작하는 문장에서만 씁니다.")
        if "[" in sentence:
            problems.append("근거 표시([…])를 붙이지 않습니다.")
        if scan(sentence):
            problems.append("투자 판단·가치판단 표현을 쓰지 않습니다.")
    if problems:
        raise OutputProblem(list(dict.fromkeys(problems)))
    return sentences


def _company_name_pattern(name: str | None) -> re.Pattern[str] | None:
    """회사 이름이 낱말로 쓰인 곳(앞이 낱말 글자가 아니고, 뒤가 낱말 끝이거나 조사)만 찾는 패턴.

    '공매도' 안의 '매도'처럼 다른 낱말의 일부는 회사를 가리키지 않으므로 걸지 않는다.
    이름 안의 띄어쓰기는 있든 없든 같게 본다.
    """
    words = name.split() if name else []
    if not words:
        return None
    body = r"\s*".join(re.escape(w) for w in words)
    return re.compile(rf"(?<![가-힣A-Za-z0-9]){body}(?:{_PARTICLES})?(?![가-힣A-Za-z0-9])")


def general_lead(term: str) -> str:
    """일반 설명의 첫 문장. 용어 끝 글자의 받침으로 은/는을 고른다(한글이 아니면 '은(는)')."""
    last = term.strip()[-1:] if term.strip() else ""
    if "가" <= last <= "힣":
        topic = "은" if (ord(last) - ord("가")) % 28 else "는"
    else:
        topic = "은(는)"
    return GENERAL_LEAD.format(term=term, topic=topic)


def term_general_final(step: StepInput, term: str, sentences: list[str]) -> FinalAnswer:
    """일반 설명 답. 첫·끝 안내 문장은 코드가 붙이고 근거 표시는 없다(ADR-0064)."""
    answer = " ".join([general_lead(term), *sentences, GENERAL_TAIL])
    return FinalAnswer(ANSWERED, answer, [], _glossary_actions(step), general_explanation=True)


def report_quote_final(step: StepInput) -> FinalAnswer | None:
    """보고서 설명 풀이가 끝내 검토를 통과하지 못했을 때: 풀이를 빼고 원문 인용만(ADR-0061).

    인용 글에서 용어가 든 문장을 그대로 쓰므로 정의를 지어내지 않는다. 보고서 설명이 없으면 None.
    """
    found = report_explanation(step)
    if found is None:
        return None
    evidence_id, quote = found
    term = _compact_term(missing_terms(step)[0].query)
    sentence = next(
        (s.strip() for s in _QUOTE_SENTENCE.findall(quote) if term in _compact_term(s)),
        quote.strip(),
    )
    return FinalAnswer(ANSWERED, f'{REPORT_QUOTE} "{sentence}"[{evidence_id}]', [evidence_id], [])


def term_answer_problem(answer: str, step: StepInput) -> tuple[str, str] | None:
    """용어 풀이 답 검사(ADR-0061). 통과하면 None.

    카드로 답할 때는 '더 쉽게' 요청이면 문장 수만 본다(#823, MAX_EASIER_SENTENCES 이하).
    보고서 설명으로 답할 때는 아래 풀이 문장 검사를 한다(이미 인용 + 한 문장이라 짧다).

    정해 둔 첫 문장('이 회사 보고서에 적힌 설명이에요.') 밖의 문장은 모두 그 인용을 근거로 표시하고,
    내용 낱말(두 글자 이상, 틀 낱말 제외)이 모두 인용 글에 있어야 한다. 낱말은 앞 두 글자 이상이
    인용에 있으면 있다고 본다('부채는' → '부채'). 낱말 대조라 뜻이 맞는지까지는 보지 못한다.
    """
    found = report_explanation(step)
    if found is None:
        if easier_request(step) and len(split_sentences(answer)) > MAX_EASIER_SENTENCES:
            return EASIER_ANSWER_TOO_LONG, (
                f"'더 쉽게' 요청이므로 {MAX_EASIER_SENTENCES}문장 이내로 다시 씁니다. "
                "확인할 곳 칸은 빼고, 쉬운 뜻 한 문장·예시 한 문장·이 회사 값 한 문장만 씁니다."
            )
        return None
    evidence_id, quote = found
    source = _compact_term(quote)
    for sentence in split_sentences(answer):
        body = without_markers(sentence).strip()
        if body == REPORT_QUOTE:
            continue
        if f"[{evidence_id}]" not in sentence:
            return REPORT_EXPLANATION_UNSUPPORTED, (
                f"보고서 설명으로 답할 때는 첫 문장('{REPORT_QUOTE}') 밖의 문장에 "
                f"인용한 원문 근거 [{evidence_id}]를 붙입니다."
            )
        unsupported = [
            w
            for w in _CONTENT_WORD.findall(body)
            if w not in _FRAME_WORDS and not _in_source(w.lower(), source)
        ]
        if unsupported:
            return REPORT_EXPLANATION_UNSUPPORTED, (
                f"풀이 문장의 낱말 {unsupported[:3]}가 인용한 원문에 없습니다. "
                "원문 문장을 그대로 인용하고, 쉬운 말 풀이는 인용 문단에 있는 낱말로 "
                "한 문장까지만 씁니다."
            )
    return None


def _in_source(word: str, source: str) -> bool:
    return any(word[:n] in source for n in range(len(word), 1, -1))


def _compact_term(text: str) -> str:
    return re.sub(r"\s+", "", text).lower()


def cross_check(step: StepInput) -> CrossCheck:
    """교차 검증 결과. 계정마다 수치 방향과 같은 계정의 회사 설명 인용 방향을 대조한다."""
    # 화면에서 고른 변경(ctx-financial)과 Workflow 결과에 같은 계정이 있으면 한 번만 센다
    changes = list(
        {
            item.facts.change_id: item
            for result in _ok(step, FINANCIAL_CHANGES)
            for item in result.items
            if item.facts is not None
            and item.facts.change_id is not None
            and item.facts.calc_status
        }.values()
    )
    quotes = _explanation_quotes(step)
    compared = [c for c in changes if c.facts and c.facts.calc_status in COMPARED_STATUSES]
    other_basis = [c for c in changes if c.facts and c.facts.calc_status in NOT_COMPARABLE_STATUSES]
    if not compared and other_basis:
        return CrossCheck(NOT_COMPARABLE, NOT_COMPARABLE_REASON)
    matched = 0
    opposite = 0
    for change in compared:
        assert change.facts is not None
        number = change.facts.direction
        if number not in (UP, DOWN):
            continue
        said = {d for q in quotes.get(change.facts.change_id, []) if (d := _said_direction(q))}
        if not said:
            continue
        if any(d != number for d in said):
            opposite += 1
        else:
            matched += 1
    checked = matched + opposite
    if opposite:
        return CrossCheck(
            POTENTIAL_MISMATCH,
            f"대조한 계정 {checked}개 중 {opposite}개의 회사 설명 방향이 수치 방향과 반대예요. "
            "검토할 신호이고 오류로 확정한 것은 아니에요.",
        )
    if matched:
        return CrossCheck(
            CONSISTENT, f"대조한 계정 {checked}개 모두 회사 설명 방향이 수치 방향과 같아요."
        )
    return CrossCheck(INSUFFICIENT_EVIDENCE, INSUFFICIENT_REASON)


def _said_direction(item: ResultItem) -> str | None:
    text = _HEAD.sub("", item.text)
    up = bool(_UP_WORDS.search(text))
    down = bool(_DOWN_WORDS.search(text))
    if up == down:  # 양쪽이 다 있거나(여러 계정이 섞인 인용) 하나도 없음
        return None
    return UP if up else DOWN


def _explanation_quotes(step: StepInput) -> dict[int, list[ResultItem]]:
    """계정(changeId) → 저장된 회사 설명 인용(STATED·RELATED).

    재무 요약 줄(F…)은 빼고 원문 인용만 본다.
    """
    quotes: dict[int, list[ResultItem]] = {}
    for result in _ok(step, SUMMARY):
        for item in result.items:
            if (
                item.facts is not None
                and item.facts.change_id is not None
                and item.grade in EXPLANATION_GRADES
                and item.evidence_id
                and "#B" in item.evidence_id
            ):
                quotes.setdefault(item.facts.change_id, []).append(item)
    return quotes


def _ok(step: StepInput, name: str) -> list[ToolResult]:
    return [r for r in step.tool_results if r.ok and r.name == name]


def _argument_problem(step: StepInput, name: str, arguments: dict[str, Any]) -> str | None:
    tool = step.tool(name)
    if tool is None:
        return "없는 Tool"
    return schema_problem(arguments, tool.parameters)


def _calls(
    step: StepInput, workflow: str, wanted: list[tuple[str, dict[str, Any]]]
) -> list[ToolCall]:
    """받은 tools에 있고 인자가 맞으며 아직 같은 인자로 부르지 않은 것만."""
    prefix = _CALL_PREFIX[workflow]
    calls: list[ToolCall] = []
    for name, arguments in wanted:
        if _argument_problem(step, name, arguments):
            continue
        if any(r.name == name and r.arguments == arguments for r in step.tool_results):
            continue
        calls.append(
            ToolCall(f"{prefix}{len(step.tool_results) + len(calls) + 1}", name, arguments)
        )
    return calls
