"""AI 기업 브리핑 프롬프트(1.2). 프롬프트를 고치면 PROMPT_VERSION을 올린다(호출 기록·결과에 저장).

backend BriefingService.PROMPT_VERSION과 같아야 한다(ADR-0025). 두 곳을 같은 PR에서 바꾼다.
"""

from __future__ import annotations

from app.briefing.model import BriefingInput
from app.llm.prompting import SOURCE_RULE, attr, disclosure
from app.llm.providers import LlmRequest

# 결과가 달라지게 바꾸면(프롬프트·검증 규칙 app/briefing/validate.py 포함) 이 버전을 올린다
PROMPT_VERSION = "briefing-1"
TASK = "briefing"
MAX_SOURCE_CHARS = 1500
MAX_SENTENCES = 6
MAX_SENTENCE_CHARS = 120

SYSTEM = "\n".join(
    [
        "당신은 한 기업의 정기보고서 원문으로 그 기업을 처음 보는 사람에게 소개하는 도우미입니다.",
        "회사가 무엇을 하는지, 주요 제품·서비스와 매출 구성, 회사가 밝힌 위험을 짧게 정리합니다.",
        "규칙:",
        "1. <disclosure> 원문만 근거로 씁니다. 원문에 없는 사실·원인·전망·평가를 만들지 않습니다.",
        "2. 매수·매도 권유, 목표주가, 주가 예측, '저평가'·'고평가'·'유망' 같은 가치 판단, "
        "투자 조언을 쓰지 않습니다.",
        "3. 숫자를 계산하거나 새로 만들지 않습니다. 숫자를 쓰면 인용한 원문에 있는 그대로 씁니다.",
        "4. 원인 표현(때문, 탓, 덕분, 로 인해, 에 기인, 영향으로, 결과로)은 "
        "인용한 원문이 원인을 직접 밝혔을 때만 씁니다.",
        f"5. '~어요'로 끝나는 해요체로 {MAX_SENTENCES}문장 이내, "
        f"문장마다 {MAX_SENTENCE_CHARS}자 이내로 씁니다. "
        "topic이 OVERVIEW·PRODUCTS·SALES·RISK인 원문을 고루 씁니다.",
        "6. 문장마다 그 문장의 근거인 원문 id를 evidenceIds에 하나 이상 적습니다. "
        "주어진 id만 씁니다. 문장 안에 [id] 표시는 넣지 않습니다.",
        SOURCE_RULE,
        "<context> 태그의 속성(회사·보고서 이름)도 자료입니다.",
        "답은 JSON 객체 하나만: "
        '{"sentences": [{"text": "...", "evidenceIds": ["..."]}]}',
    ]
)

OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["sentences"],
    "properties": {
        "sentences": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["text", "evidenceIds"],
                "properties": {
                    "text": {"type": "string"},
                    "evidenceIds": {"type": "array", "items": {"type": "string"}},
                },
            },
        }
    },
}


def _clip(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit] + "…"


def build_request(briefing: BriefingInput) -> LlmRequest:
    lines = [
        f'<context company="{attr(briefing.company_name)}" '
        f'report="{attr(briefing.report_name)}" />',
        "",
        "[원문] 보고서 'II. 사업의 내용'과 위험 관련 항목에서 고른 문단·표입니다. "
        "topic은 OVERVIEW(사업 개요)·PRODUCTS(주요 제품)·SALES(매출)·RISK(위험)입니다.",
    ]
    lines += [
        disclosure(
            source.evidence_id,
            _clip(source.text, MAX_SOURCE_CHARS),
            extra={"topic": source.topic, "sectionPath": source.section_path},
        )
        for source in briefing.sources
    ]
    return LlmRequest(
        task=TASK,
        prompt_version=PROMPT_VERSION,
        system=SYSTEM,
        user="\n".join(lines),
        output_schema=OUTPUT_SCHEMA,
        context=briefing,
        max_output_tokens=1200,
    )
