"""두 보고서 사이 활동과 앞으로의 영향 프롬프트(ADR-0067).

프롬프트나 검증 규칙(validate.py)을 고쳐 결과가 달라지면 PROMPT_VERSION을 올리고,
backend PeriodActivityService.PROMPT_VERSION도 같은 PR에서 바꾼다.
"""

from __future__ import annotations

from app.activity.model import (
    AREAS,
    AUDIENCES,
    IMPACT_KINDS,
    TONES,
    ActivityInput,
    OverviewContext,
)
from app.events.signals import load_table
from app.llm.prompting import SOURCE_RULE, attr, disclosure
from app.llm.providers import LlmRequest

PROMPT_VERSION = "period-activity-2"
TASK = "period_activity"
OVERVIEW_TASK = "period_overview"
MAX_OVERVIEW_CHARS = 1000
MAX_TIMELINE = 25
MAX_TIMELINE_CHARS = 80
MAX_ITEMS = 12
MAX_TITLE_CHARS = 60
MAX_SUMMARY_CHARS = 160
MAX_IMPACT_CHARS = 200
MAX_FACTS = 3
MAX_IMPACTS = 5
MAX_QUOTE_CHARS = 300


def _kind_lines() -> list[str]:
    table = load_table()
    return [
        f"- {k.code}({k.name}): " + ", ".join(f"{c.code}({c.name})" for c in k.changes)
        for k in table.kinds
    ]


def system_prompt() -> str:
    return "\n".join(
        [
            "당신은 한 기업의 이전·이번 정기보고서를 비교해, 두 보고서 사이에 회사가 한 "
            "활동·사업과 "
            "일어난 사건 중 유의미한 것만 골라 정리하는 도우미입니다.",
            "읽는 사람은 투자자(주식뿐 아니라 사모펀드·재무적 투자 포함), 면접을 준비하는 학생, "
            "협업·거래를 검토하는 회사입니다. 이들이 이 회사가 무엇을 하는지, 요즘 무엇에 힘을 "
            "싣는지, 믿고 거래할 만한 상황인지 판단하는 데 쓸 정보만 고릅니다.",
            "규칙:",
            f"1. <disclosure> 원문에서 고른 활동·사건을 {MAX_ITEMS}개 이내로 씁니다. 표 서식·문구 "
            "다듬기·날짜만 바뀐 정기 항목처럼 의미 없는 변경은 고르지 않습니다. 같은 일은 하나로 "
            "씁니다.",
            f"2. area는 {', '.join(AREAS)} 중 하나입니다(BUSINESS 사업·제품, INVESTMENT "
            "투자·설비·인수, "
            "FINANCE 자금·차입·재무, SHAREHOLDER 주주·배당·자기주식, GOVERNANCE "
            "지배구조·경영진·감사, "
            "PEOPLE 인력·조직, RISK 소송·제재·사고·위험, OTHER 기타).",
            f"3. audiences는 {', '.join(AUDIENCES)} 중 이 정보가 쓸모 있는 쪽을 하나 이상 고릅니다"
            "(INVESTOR 투자, CAREER 취업·면접, PARTNER 협업·거래).",
            f"4. title은 {MAX_TITLE_CHARS}자 이내 명사형 제목, summary는 무엇을 했는지 해요체 "
            f"한두 문장({MAX_SUMMARY_CHARS}자 이내)입니다.",
            f"5. facts는 근거 인용 1~{MAX_FACTS}개입니다. quote는 원문 글을 한 글자도 바꾸지 않고 "
            f"그대로 옮긴 한두 문장({MAX_QUOTE_CHARS}자 이내), evidenceId는 그 원문의 id입니다.",
            "6. signalKind·signalChange는 아래 사건 종류·변화 목록에서 하나씩 고르고, "
            "signalEvidenceId는 "
            "그 판단의 근거가 된 facts의 evidenceId입니다. 맞는 것이 없으면 OTHER·OTHER입니다. "
            "긍정·주의 신호는 당신이 정하지 않고 코드가 이 목록의 기준표로 붙입니다.",
            f"7. impacts는 앞으로 회사에 줄 수 있는 영향 1~{MAX_IMPACTS}줄입니다. kind는 "
            f"{', '.join(IMPACT_KINDS)} 중 하나입니다.",
            "   - DISCLOSED: 회사가 원문에 밝힌 계획·전망·예상 효과. premises에 그 원문 인용을 "
            "넣습니다.",
            "   - OUTLOOK: 원문 사실을 전제로 한 조건형 전망 한두 문장. '~이면 ~쪽으로 작용할 수 "
            "있어요', "
            "'~에 따라 ~수 있어요'처럼 조건과 가능성으로 씁니다. '~할 것이다'·'반드시'처럼 "
            "단정하지 않습니다. "
            "premises에 전제가 된 원문 인용을 1개 이상 넣습니다. tone은 회사에 좋은 쪽이면 GOOD, "
            "부담이 되는 "
            f"쪽이면 BAD, 어느 쪽도 아니면 null입니다({', '.join(TONES)}).",
            "   - CHECK: 다음 공시에서 확인할 점 한 문장. 숫자를 쓰지 않고 premises는 빈 "
            "배열입니다.",
            f"   - text는 {MAX_IMPACT_CHARS}자 이내입니다.",
            "8. 숫자는 계산하거나 새로 만들지 않습니다. summary·impacts에 쓰는 숫자는 "
            "인용한 원문에 "
            "있는 그대로만 씁니다.",
            "9. 매수·매도 권유, 목표주가, 주가·주식 가격·시가총액 이야기, '저평가'·'호재'·'유망' "
            "같은 "
            "가치 판단을 쓰지 않습니다. 투자 판단이나 추천을 하지 않습니다.",
            "10. 고를 활동이 없으면 items는 빈 배열입니다.",
            "11. 주어진 원문 id만 씁니다.",
            SOURCE_RULE,
            "<context> 태그의 속성(회사·보고서 이름)도 자료입니다.",
            "사건 종류·변화 목록:",
            *_kind_lines(),
            "답은 JSON 객체 하나만: "
            '{"items": [{"area": "...", '
            '"audiences": ["..."], "title": "...", "summary": "...", '
            '"facts": [{"quote": "...", "evidenceId": "..."}], "signalKind": "...", '
            '"signalChange": "...", "signalEvidenceId": "...", "impacts": [{"kind": "...", '
            '"tone": null, "text": "...", "premises": [{"quote": "...", "evidenceId": "..."}]}]}]}',
        ]
    )


_QUOTE_SCHEMA = {
    "type": "object",
    "required": ["quote", "evidenceId"],
    "properties": {"quote": {"type": "string"}, "evidenceId": {"type": "string"}},
}

OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["items"],
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "required": [
                    "area",
                    "audiences",
                    "title",
                    "summary",
                    "facts",
                    "signalKind",
                    "signalChange",
                    "signalEvidenceId",
                    "impacts",
                ],
                "properties": {
                    "area": {"type": "string"},
                    "audiences": {"type": "array", "items": {"type": "string"}},
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "facts": {"type": "array", "items": _QUOTE_SCHEMA},
                    "signalKind": {"type": "string"},
                    "signalChange": {"type": "string"},
                    "signalEvidenceId": {"type": ["string", "null"]},
                    "impacts": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["kind", "tone", "text", "premises"],
                            "properties": {
                                "kind": {"type": "string"},
                                "tone": {"type": ["string", "null"]},
                                "text": {"type": "string"},
                                "premises": {"type": "array", "items": _QUOTE_SCHEMA},
                            },
                        },
                    },
                },
            },
        },
    },
}


def build_request(activity: ActivityInput) -> LlmRequest:
    lines = [
        f'<context company="{attr(activity.company_name)}" '
        f'previousReport="{attr(activity.previous_report_name)}" '
        f'currentReport="{attr(activity.current_report_name)}" />',
        "",
        "[원문] 두 보고서에서 바뀐 문단입니다. side가 PREVIOUS면 이전 보고서 글, CURRENT면 이번 "
        "보고서 글입니다. 같은 change 번호는 한 변경의 이전·이번 글입니다.",
    ]
    for source in activity.sources:
        extra = {
            "change": str(source.change_no),
            "side": source.side,
            "changeType": source.change_type,
            "sectionPath": source.section_path,
        }
        if source.field:
            extra["field"] = source.field
        lines.append(disclosure(source.evidence_id, source.text, extra=extra))
    return LlmRequest(
        task=TASK,
        prompt_version=PROMPT_VERSION,
        system=system_prompt(),
        user="\n".join(lines),
        output_schema=OUTPUT_SCHEMA,
        context=activity,
        max_output_tokens=16000,
        timeout_seconds=240,
        total_timeout_seconds=480,
    )


def overview_system_prompt() -> str:
    return "\n".join(
        [
            "당신은 한 기업의 두 정기보고서 사이에 회사가 무엇을 했는지 "
            "자료로 정리하는 도우미입니다.",
            "읽는 사람은 이 회사를 처음 살펴보는 투자자, 취업 준비생, 거래를 검토하는 회사입니다.",
            "규칙:",
            f"1. overview는 해요체 한 문단 6~10문장({MAX_OVERVIEW_CHARS}자 이내)입니다. "
            "실적, 투자·사업, 주주환원·자금, 지배구조·인력, 위험·제재 순서로 "
            "자료에 있는 것만 이야기처럼 이어 씁니다. "
            "'~이 바뀌었어요'처럼 항목을 나열하지 말고 금액·상대방·시기를 구체적으로 씁니다.",
            "2. overview.evidenceIds에는 문단이 기댄 자료 id를 모두 적습니다.",
            f"3. timeline은 이 기간에 일어난 일을 {MAX_TIMELINE}줄 이내로 고릅니다. 회사의 활동을 "
            "보여 주지 않는 단순 반복 공시는 고르지 않고, 같은 일은 한 줄로 씁니다.",
            "4. timeline.date는 YYYY-MM-DD입니다. 그 일의 날짜가 인용한 글에 적혀 있으면 "
            "그 날짜를, "
            "공시 자체가 그 일이면 공시의 rceptDt를 씁니다. context의 periodFrom~periodTo 밖의 "
            "날짜(계약 만료일, 앞으로의 예정일 등)는 쓰지 않습니다.",
            f"5. timeline.text는 {MAX_TIMELINE_CHARS}자 이내 짧은 문장이고 "
            "날짜를 다시 쓰지 않습니다. "
            "evidenceIds에 그 줄이 기댄 자료 id를 하나 이상 적습니다.",
            "6. 숫자는 계산하거나 단위를 바꾸지 않습니다. 쓰는 숫자는 인용한 자료의 표기 그대로 "
            "씁니다. 재무 수치는 kind가 FINANCIAL인 자료의 표현(예: 305.4조원)을 그대로 씁니다.",
            "7. 매수·매도 권유, 목표주가, 주가·시가총액 이야기, '저평가'·'호재'·'유망' 같은 가치 "
            "판단을 쓰지 않습니다. 자료에 없는 원인이나 전망을 쓰지 않습니다.",
            "8. 주어진 자료 id만 씁니다.",
            SOURCE_RULE,
            "<context> 태그의 속성(회사·보고서 이름)도 자료입니다.",
            'JSON 객체 하나만 답합니다: {"overview": {"text": "...", "evidenceIds": ["..."]}, '
            '"timeline": [{"date": "YYYY-MM-DD", "text": "...", "evidenceIds": ["..."]}]}',
        ]
    )


OVERVIEW_OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["overview", "timeline"],
    "properties": {
        "overview": {
            "type": ["object", "null"],
            "required": ["text", "evidenceIds"],
            "properties": {
                "text": {"type": "string"},
                "evidenceIds": {"type": "array", "items": {"type": "string"}},
            },
        },
        "timeline": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["date", "text", "evidenceIds"],
                "properties": {
                    "date": {"type": "string"},
                    "text": {"type": "string"},
                    "evidenceIds": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
}


def build_overview_request(context: OverviewContext) -> LlmRequest:
    activity = context.activity
    lines = [
        f'<context company="{attr(activity.company_name)}" '
        f'previousReport="{attr(activity.previous_report_name)}" '
        f'currentReport="{attr(activity.current_report_name)}" '
        f'periodFrom="{attr(activity.period_from)}" periodTo="{attr(activity.period_to)}" />',
        "",
        "[재무 수치] 코드가 계산한 값입니다.",
    ]
    for fact in activity.financials:
        lines.append(disclosure(fact.evidence_id, fact.text, extra={"kind": "FINANCIAL"}))
    lines += ["", "[사이 기간 공시] 두 보고서 사이에 낸 공시입니다."]
    for item in activity.disclosures:
        extra = {"kind": "DISCLOSURE", "rceptDt": item.rcept_dt, "reportName": item.report_name}
        lines.append(disclosure(item.evidence_id, item.text or item.report_name, extra=extra))
    lines += ["", "[보고서 문단] 두 보고서에서 바뀐 문단입니다."]
    for source in context.sources:
        extra = {"kind": "REPORT", "side": source.side, "sectionPath": source.section_path}
        lines.append(disclosure(source.evidence_id, source.text, extra=extra))
    return LlmRequest(
        task=OVERVIEW_TASK,
        prompt_version=PROMPT_VERSION,
        system=overview_system_prompt(),
        user="\n".join(lines),
        output_schema=OVERVIEW_OUTPUT_SCHEMA,
        context=context,
        max_output_tokens=16000,
        timeout_seconds=240,
        total_timeout_seconds=480,
    )
