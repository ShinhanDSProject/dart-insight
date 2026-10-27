"""회사가 밝힌 전망·계획 프롬프트(1.9).

프롬프트를 고치면 PROMPT_VERSION을 올린다(호출 기록·결과에 저장).

backend OutlookService.PROMPT_VERSION과 같아야 한다(ADR-0039). 두 곳을 같은 PR에서 바꾼다.
"""

from __future__ import annotations

from app.llm.prompting import SOURCE_RULE, attr, disclosure
from app.llm.providers import LlmRequest
from app.outlook.model import OutlookInput

# 결과가 달라지게 바꾸면(프롬프트·검증 규칙 app/outlook/validate.py 포함) 이 버전을 올린다
PROMPT_VERSION = "outlook-1"
TASK = "outlook"
MAX_ITEMS = 10
MAX_SUMMARY_CHARS = 100
MAX_QUOTE_CHARS = 300

SYSTEM = "\n".join(
    [
        "당신은 한 기업의 사업보고서 원문에서 회사가 스스로 밝힌 계획·전망 문장을 "
        "찾아 정리하는 도우미입니다.",
        "회사가 앞으로 하겠다고 공시한 투자·설비, 신규 사업·제품, 시장·업황 전망, "
        "재무·주주 정책을 모읍니다.",
        "규칙:",
        "1. <disclosure> 원문에 회사가 쓴 계획·전망 문장만 고릅니다. "
        "이미 지난 실적·사실 설명은 고르지 않습니다.",
        "2. 회사의 문장을 요약만 합니다. 계획이 실현될지, 좋은지 나쁜지, 주가·실적이 어떻게 될지 "
        "판단·평가·예측을 더하지 않습니다. 매수·매도 권유, 목표주가, '저평가'·'유망' 같은 "
        "가치 판단을 쓰지 않습니다.",
        "3. category는 INVESTMENT(투자·설비), NEW_BUSINESS(신규 사업·제품), "
        "MARKET(시장·업황 전망), "
        "FINANCIAL(재무·주주 정책), OTHER(기타) 중 하나입니다.",
        "4. quote는 근거 원문의 글을 한 글자도 바꾸지 않고 그대로 옮긴 한두 문장"
        f"({MAX_QUOTE_CHARS}자 이내)입니다.",
        "5. summary는 '~라고 밝혔어요'처럼 회사가 밝힌 내용임을 드러내는 해요체 한 문장"
        f"({MAX_SUMMARY_CHARS}자 이내)입니다. "
        "숫자를 계산하거나 새로 만들지 않고, 숫자를 쓰면 quote에 있는 그대로 씁니다.",
        "6. 원인 표현(때문, 탓, 덕분, 로 인해, 에 기인, 영향으로, 결과로)은 "
        "quote가 원인을 직접 밝혔을 때만 씁니다.",
        "7. evidenceIds에는 quote를 옮긴 원문 id를 적습니다. 주어진 id만 씁니다.",
        f"8. 항목은 {MAX_ITEMS}개 이내이고 같은 계획을 두 번 쓰지 않습니다. "
        '계획·전망 문장이 없으면 {"items": []}로 답합니다.',
        SOURCE_RULE,
        "<context> 태그의 속성(회사·보고서 이름)도 자료입니다.",
        "답은 JSON 객체 하나만: "
        '{"items": [{"category": "...", "summary": "...", "quote": "...", '
        '"evidenceIds": ["..."]}]}',
    ]
)

OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["items"],
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["category", "summary", "quote", "evidenceIds"],
                "properties": {
                    "category": {"type": "string"},
                    "summary": {"type": "string"},
                    "quote": {"type": "string"},
                    "evidenceIds": {"type": "array", "items": {"type": "string"}},
                },
            },
        }
    },
}


def build_request(outlook: OutlookInput) -> LlmRequest:
    lines = [
        f'<context company="{attr(outlook.company_name)}" '
        f'report="{attr(outlook.report_name)}" />',
        "",
        "[원문] 사업보고서 '이사의 경영진단 및 분석의견'과 'II. 사업의 내용'의 설비·투자·연구개발·"
        "기타 참고사항에서 고른 문단입니다.",
    ]
    lines += [
        disclosure(source.evidence_id, source.text, extra={"sectionPath": source.section_path})
        for source in outlook.sources
    ]
    return LlmRequest(
        task=TASK,
        prompt_version=PROMPT_VERSION,
        system=SYSTEM,
        user="\n".join(lines),
        output_schema=OUTPUT_SCHEMA,
        context=outlook,
        max_output_tokens=2000,
    )
