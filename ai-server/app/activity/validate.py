"""두 보고서 사이 활동과 앞으로의 영향 검증(ADR-0067, 5.5).

코드가 카드마다 확인한다. 하나라도 어기면 문제를 알려 다시 만든다(service.py).
- 분야·쓰임·영향 종류·좋은 면/나쁜 면이 정한 값이다. 카드는 0~12개다.
- 인용(facts·premises)의 근거 ID가 보낸 원문이고, 인용 글이 그 원문의 부분 문자열이다.
- AI가 쓴 글(제목·요지·영향)의 숫자·크기 표현이 그 글이 기댄 인용에 있다(app.llm.grounding).
  확인할 점에는 숫자를 쓰지 않는다.
- 요지의 원인 표현은 인용에도 원인 표현이 있을 때만 쓴다.
- AI 전망은 전제가 1개 이상이고, 조건과 가능성 꼬리가 있으며, 단정과 주가 낱말이 없다.
- 모든 AI 글이 투자 권유성 표현 검사(app.compliance)를 통과한다. 걸리면 규칙 ID를 남긴다.
요약·타임라인(ADR-0068)은 check_overview가 확인한다. 타임라인 날짜는 비교 기간 안이고, 인용한 글에
있거나 인용한 공시의 접수일이어야 한다.
신호는 LLM이 아니라 이 모듈이 신호 기준표(app.events.signals.load_table)로 붙인다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from datetime import date
from typing import Any

from app.activity.model import (
    AREAS,
    AUDIENCES,
    CAUTION,
    CHECK,
    CURRENT,
    EMPTY,
    EVIDENCE_NOT_CONFIRMED,
    GENERATED,
    HOLD,
    IMPACT_KINDS,
    MIXED_SIDES,
    NO_CRITERIA,
    OUTLOOK,
    POSITIVE,
    TONES,
    Activity,
    ActivityInput,
    ActivityResult,
    Impact,
    Overview,
    OverviewContext,
    OverviewResult,
    Quote,
    Signal,
    Source,
    TimelineEntry,
)
from app.activity.prompt import MAX_FACTS, MAX_IMPACTS, MAX_ITEMS, MAX_TIMELINE
from app.compliance import scan
from app.events.signals import SignalTable, load_table
from app.llm.grounding import number_problem
from app.summary.causal import find as find_causal

# 프롬프트가 요구한 길이보다 조금 넉넉히 본다
MAX_TITLE = 80
MAX_SUMMARY = 220
MAX_IMPACT = 260
MAX_QUOTE = 500
MIN_QUOTE = 8
MAX_OVERVIEW = 1300
MAX_TIMELINE_TEXT = 120
OTHER_CODE = "OTHER"
MIXED = "MIXED"

_SPACES = re.compile(r"\s+")
_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
_DIGIT = re.compile(r"\d")
# AI 전망: 조건과 가능성 꼬리가 있어야 하고 단정은 막는다
_CONDITION = re.compile(r"면|에 따라|경우|지만|더라도|만큼")
_POSSIBILITY = re.compile(r"수 있어요|쪽이에요|쪽으로 작용|가능성이 있어요|달라져요|달라질 수")
_ASSERTIVE = re.compile(r"것이다|거예요|게 된다|게 돼요|반드시|틀림없|확실히|분명히|확실해요")
# AI 전망 결론에만 쓰는 주가 낱말 검사(ADR-0065). 공시 인용에는 쓰지 않는다
_STOCK_WORDS = re.compile(r"(?<![가-힣])(?:주가|목표가|시총)|주식\s*가격|시가\s*총액")


@dataclass(frozen=True)
class Checked:
    """problems가 없으면 result가 있다. 있어도 valid_items에 통과한 부분이 남는다."""

    result: ActivityResult | None
    problems: list[str] = field(default_factory=list)
    blocked_rules: list[str] = field(default_factory=list)
    valid_items: list[Activity] = field(default_factory=list)


def normalize(text: str) -> str:
    """비교용 글: 프롬프트에서 바꿔 넣은 &lt; 등을 되돌리고 이어진 공백을 한 칸으로."""
    plain = text.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    plain = plain.replace("&amp;", "&")
    return _SPACES.sub(" ", plain).strip()


class Problem(Exception):
    def __init__(self, message: str, rules: list[str] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.rules = rules or []


def check(data: Any, activity: ActivityInput, table: SignalTable | None = None) -> Checked:
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        return Checked(None, ["items 배열이 있는 JSON 객체가 필요합니다."])
    raw = data["items"]
    if len(raw) > MAX_ITEMS:
        return Checked(None, [f"items는 {MAX_ITEMS}개 이내여야 합니다(지금 {len(raw)}개)."])
    table = table or load_table()
    sources = {s.evidence_id: s for s in activity.sources}
    texts = {s.evidence_id: normalize(s.text) for s in activity.sources}
    items: list[Activity] = []
    problems: list[str] = []
    blocked: set[str] = set()
    for no, entry in enumerate(raw, start=1):
        try:
            items.append(_item(entry, sources, texts, table))
        except Problem as p:
            problems.append(f"{no}번 카드: {p.message}")
            blocked.update(p.rules)
    if problems:
        return Checked(None, problems, sorted(blocked), items)
    status = GENERATED if items else EMPTY
    return Checked(ActivityResult(status, None, items), [], [], items)


def _item(
    entry: Any, sources: dict[str, Source], texts: dict[str, str], table: SignalTable
) -> Activity:
    if not isinstance(entry, dict):
        raise Problem("area·audiences·title·summary·facts·impacts가 있는 객체여야 합니다.")
    area = entry.get("area")
    if area not in AREAS:
        raise Problem(f"area는 {', '.join(AREAS)} 중 하나여야 합니다.")
    audiences = entry.get("audiences")
    if (
        not isinstance(audiences, list)
        or not audiences
        or any(a not in AUDIENCES for a in audiences)
    ):
        raise Problem(f"audiences는 {', '.join(AUDIENCES)} 중 하나 이상이어야 합니다.")
    title = require_text(entry.get("title"), "title", MAX_TITLE)
    summary = require_text(entry.get("summary"), "summary", MAX_SUMMARY)
    facts = _quotes(entry.get("facts"), texts, "facts", required=True)
    if len(facts) > MAX_FACTS:
        raise Problem(f"facts는 {MAX_FACTS}개 이내여야 합니다.")
    fact_texts = {f"f{i}": f.quote for i, f in enumerate(facts)}
    for name, value in (("title", title), ("summary", summary)):
        problem = number_problem(value, fact_texts, list(fact_texts))
        if problem:
            raise Problem(f"{name}: {problem.replace('인용한 원문', 'facts의 인용')}")
        check_expression(value, name)
    claim = find_causal(summary)
    if claim and not any(find_causal(f.quote) for f in facts):
        raise Problem(f"원인 표현('{claim}')은 인용이 원인을 직접 밝혔을 때만 씁니다.")
    impacts = _impacts(entry.get("impacts"), texts)
    signal = _signal(entry, facts, sources, table)
    change_nos = tuple(
        dict.fromkeys(sources[q.evidence_id].change_no for q in (*facts, *_premises(impacts)))
    )
    return Activity(
        area, tuple(dict.fromkeys(audiences)), title, summary, facts, impacts, signal, change_nos
    )


def _premises(impacts: tuple[Impact, ...]) -> list[Quote]:
    return [p for i in impacts for p in i.premises]


def require_text(value: Any, name: str, limit: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise Problem(f"{name}에 글이 있어야 합니다.")
    value = value.strip()
    if len(value) > limit:
        raise Problem(f"{name}가 {limit}자를 넘습니다.")
    return value


def check_expression(text: str, name: str) -> None:
    findings = scan(text)
    if findings:
        labels = ", ".join(dict.fromkeys(f.label for f in findings))
        quoted = ", ".join(f"'{f.matched}'" for f in findings[:3])
        raise Problem(
            f"{name}에 투자 권유로 읽힐 수 있는 표현이 있습니다({labels}: {quoted}). "
            "공시 사실과 조건형 영향만 중립적으로 쓰세요.",
            [f.rule_id for f in findings],
        )


def _quotes(value: Any, texts: dict[str, str], name: str, required: bool) -> tuple[Quote, ...]:
    if not isinstance(value, list) or (required and not value):
        raise Problem(f"{name}에 원문 인용이 하나 이상 있어야 합니다.")
    quotes: list[Quote] = []
    for entry in value:
        if not isinstance(entry, dict):
            raise Problem(f"{name}의 인용은 quote·evidenceId가 있는 객체여야 합니다.")
        evidence_id = entry.get("evidenceId")
        quote = entry.get("quote")
        if evidence_id not in texts:
            raise Problem(f"{name}: 주어진 원문 id가 아닙니다: {str(evidence_id)[:40]}")
        if not isinstance(quote, str) or len(normalize(quote)) < MIN_QUOTE:
            raise Problem(f"{name}: quote에 원문 글을 {MIN_QUOTE}자 이상 그대로 옮겨야 합니다.")
        quote = normalize(quote)
        if len(quote) > MAX_QUOTE:
            raise Problem(f"{name}: quote가 {MAX_QUOTE}자를 넘습니다. 한두 문장만 옮기세요.")
        if quote not in texts[evidence_id]:
            raise Problem(
                f"{name}: quote가 {evidence_id} 원문에 없습니다. 원문 글을 바꾸지 말고 그대로 "
                "옮기세요."
            )
        quotes.append(Quote(quote, evidence_id))
    return tuple(dict.fromkeys(quotes))


def _impacts(value: Any, texts: dict[str, str]) -> tuple[Impact, ...]:
    if not isinstance(value, list) or not value:
        raise Problem("impacts에 앞으로의 영향이 한 줄 이상 있어야 합니다.")
    if len(value) > MAX_IMPACTS:
        raise Problem(f"impacts는 {MAX_IMPACTS}줄 이내여야 합니다.")
    impacts: list[Impact] = []
    for no, entry in enumerate(value, start=1):
        if not isinstance(entry, dict):
            raise Problem(f"impacts {no}번 줄은 객체여야 합니다.")
        kind = entry.get("kind")
        if kind not in IMPACT_KINDS:
            kinds = ", ".join(IMPACT_KINDS)
            raise Problem(f"impacts {no}번 줄의 kind는 {kinds} 중 하나여야 합니다.")
        text = require_text(entry.get("text"), f"impacts {no}번 줄의 text", MAX_IMPACT)
        tone = entry.get("tone")
        if tone is not None and tone not in TONES:
            raise Problem(f"impacts {no}번 줄의 tone은 {', '.join(TONES)} 또는 null이어야 합니다.")
        check_expression(text, f"impacts {no}번 줄")
        if kind == CHECK:
            if _DIGIT.search(text):
                raise Problem(f"impacts {no}번 줄(CHECK)에는 숫자를 쓰지 않습니다.")
            impacts.append(Impact(CHECK, text))
            continue
        premises = _quotes(entry.get("premises"), texts, f"impacts {no}번 줄의 premises", True)
        cited = {f"p{i}": p.quote for i, p in enumerate(premises)}
        problem = number_problem(text, cited, list(cited))
        if problem:
            problem = problem.replace("인용한 원문", "premises의 인용")
            raise Problem(f"impacts {no}번 줄: {problem}")
        if kind == OUTLOOK:
            _outlook(text, no)
        impacts.append(Impact(kind, text, tone if kind == OUTLOOK else None, premises))
    return tuple(impacts)


def _outlook(text: str, no: int) -> None:
    if _STOCK_WORDS.search(text):
        raise Problem(f"impacts {no}번 줄(OUTLOOK)에 주가·시가총액 이야기를 쓰지 않습니다.")
    if _ASSERTIVE.search(text):
        raise Problem(
            f"impacts {no}번 줄(OUTLOOK)이 단정합니다. '~이면 ~쪽으로 작용할 수 있어요'처럼 쓰세요."
        )
    if not _CONDITION.search(text) or not _POSSIBILITY.search(text):
        raise Problem(
            f"impacts {no}번 줄(OUTLOOK)은 조건('~이면', '~에 따라')과 가능성('~수 있어요')이 "
            "함께 있는 조건형 문장이어야 합니다."
        )


def _signal(
    entry: dict[str, Any], facts: tuple[Quote, ...], sources: dict[str, Source], table: SignalTable
) -> Signal:
    """AI가 고른 종류·변화와 근거로 기준표의 신호를 붙인다. LLM은 신호를 정하지 않는다."""
    kind = table.kind(entry.get("signalKind"))
    change = kind.change(entry.get("signalChange")) if kind else None
    if kind is None or change is None:
        other = table.kind(OTHER_CODE)
        assert other is not None
        return Signal(HOLD, OTHER_CODE, OTHER_CODE, other.name, other.changes[0].name, NO_CRITERIA)
    evidence_id = entry.get("signalEvidenceId")
    base = Signal(HOLD, kind.code, change.code, kind.name, change.name)
    quoted = {f.evidence_id for f in facts}
    if evidence_id not in quoted:
        return replace(base, hold_reason=EVIDENCE_NOT_CONFIRMED)
    side = sources[evidence_id].side
    if change.explicit_only and side != CURRENT:
        return replace(base, hold_reason=EVIDENCE_NOT_CONFIRMED)
    if change.signal in (CAUTION, POSITIVE):
        return replace(base, signal=change.signal, evidence_id=evidence_id)
    reason = MIXED_SIDES if change.signal == MIXED else NO_CRITERIA
    return replace(base, hold_reason=reason, evidence_id=evidence_id)


@dataclass(frozen=True)
class CheckedOverview:
    """problems가 없어도 있어도 result에 통과한 요약·줄이 남는다."""

    result: OverviewResult
    problems: list[str] = field(default_factory=list)


def check_overview(data: Any, context: OverviewContext) -> CheckedOverview:
    if not isinstance(data, dict) or not isinstance(data.get("timeline"), list):
        return CheckedOverview(
            OverviewResult(), ["overview와 timeline 배열이 있는 JSON 객체가 필요합니다."]
        )
    activity = context.activity
    texts = _texts(context)
    receipts = {d.evidence_id: d.rcept_dt for d in activity.disclosures}
    problems: list[str] = []
    overview: Overview | None = None
    try:
        overview = _overview(data.get("overview"), texts)
    except Problem as p:
        problems.append(f"overview: {p.message}")
    raw = data["timeline"]
    if len(raw) > MAX_TIMELINE:
        problems.append(f"timeline은 {MAX_TIMELINE}줄 이내여야 합니다(지금 {len(raw)}줄).")
    entries: list[TimelineEntry] = []
    for no, entry in enumerate(raw[:MAX_TIMELINE], start=1):
        try:
            entries.append(_entry(entry, texts, receipts, activity))
        except Problem as p:
            problems.append(f"timeline {no}번 줄: {p.message}")
    entries = sorted(dict.fromkeys(entries), key=lambda e: e.date)
    return CheckedOverview(OverviewResult(overview, entries), problems)


def _texts(context: OverviewContext) -> dict[str, str]:
    activity = context.activity
    texts = {f.evidence_id: normalize(f.text) for f in activity.financials}
    for item in activity.disclosures:
        texts[item.evidence_id] = normalize(f"{item.report_name} {item.text}")
    for source in context.sources:
        texts[source.evidence_id] = normalize(source.text)
    return texts


def _cited(value: Any, texts: dict[str, str]) -> list[str]:
    """주어진 자료 id만 남긴다. 남은 것이 없으면 근거가 없는 것이다(ADR-0068)."""
    ids = value if isinstance(value, list) else []
    known = [i for i in ids if isinstance(i, str) and i in texts]
    if not known:
        raise Problem("evidenceIds에 주어진 자료 id가 하나도 없습니다. 자료 id를 그대로 적으세요.")
    return list(dict.fromkeys(known))


def _overview(value: Any, texts: dict[str, str]) -> Overview:
    if not isinstance(value, dict):
        raise Problem("text·evidenceIds가 있는 객체여야 합니다.")
    text = require_text(value.get("text"), "text", MAX_OVERVIEW)
    cited = _cited(value.get("evidenceIds"), texts)
    problem = number_problem(text, texts, cited)
    if problem:
        raise Problem(problem)
    check_expression(text, "overview")
    return Overview(text, tuple(cited))


def _entry(
    value: Any, texts: dict[str, str], receipts: dict[str, str], activity: ActivityInput
) -> TimelineEntry:
    if not isinstance(value, dict):
        raise Problem("date·text·evidenceIds가 있는 객체여야 합니다.")
    day = _date(value.get("date"))
    text = require_text(value.get("text"), "text", MAX_TIMELINE_TEXT)
    cited = _cited(value.get("evidenceIds"), texts)
    if activity.period_from and not activity.period_from <= day <= activity.period_to:
        raise Problem(f"date {day}가 비교 기간 밖입니다.")
    if not any(receipts.get(c) == day or _has_date(texts[c], day) for c in cited):
        raise Problem(f"date {day}가 인용한 글에 없고 인용한 공시의 접수일도 아닙니다.")
    problem = number_problem(text, texts, cited)
    if problem:
        raise Problem(problem)
    check_expression(text, "timeline")
    return TimelineEntry(day, text, tuple(cited))


def _date(value: Any) -> str:
    if not isinstance(value, str) or not _ISO_DATE.fullmatch(value):
        raise Problem("date는 YYYY-MM-DD여야 합니다.")
    try:
        date.fromisoformat(value)
    except ValueError as e:
        raise Problem("date가 없는 날짜입니다.") from e
    return value


def _has_date(text: str, day: str) -> bool:
    year, month, dom = (int(part) for part in day.split("-"))
    pattern = (
        rf"(?<!\d)(?:{year}|{year % 100:02d})\s*[.\-/년]\s*0?{month}\s*[.\-/월]\s*0?{dom}(?!\d)"
    )
    return re.search(pattern, text) is not None
