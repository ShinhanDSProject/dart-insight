"""요약 프롬프트(3.2). 프롬프트를 고치면 PROMPT_VERSION을 올린다(호출 기록·결과에 함께 저장)."""

from __future__ import annotations

from app.llm.prompting import SOURCE_RULE, disclosure
from app.llm.providers import LlmRequest
from app.summary.model import SummaryInput

PROMPT_VERSION = "summary-1"
TASK = "summary"
MAX_SOURCE_CHARS = 1500

CHANGE_LABELS = {"ADDED": "추가", "DELETED": "삭제(문서에서 빠짐)", "MODIFIED": "수정"}

SYSTEM = "\n".join(
    [
        "당신은 한 기업의 정기보고서 두 개 사이에 무엇이 바뀌었는지 정리하는 도우미입니다.",
        "규칙:",
        "1. <disclosure> 태그 안의 공시 원문만 근거로 씁니다. "
        "원문에 없는 원인·전망·평가를 만들지 않습니다.",
        "2. 매수·매도 권유, 목표주가, 주가 예측, '저평가'·'고평가' 같은 가치 판단을 쓰지 않습니다.",
        "3. 숫자를 계산하거나 새로 만들지 않습니다. 숫자를 쓰면 인용한 원문에 있는 그대로 씁니다.",
        "4. 각 문장에 근거로 쓴 원문 id를 evidenceIds에 적습니다. 주어진 id만 씁니다.",
        "5. 빠진 내용은 '문서에서 빠졌다'고만 쓰고 사업·계약이 끝났다고 단정하지 않습니다.",
        "6. '~어요'로 끝나는 한 문장(80자 안팎)으로 씁니다.",
        SOURCE_RULE,
        "답은 JSON 객체 하나만: "
        '{"items": [{"ref": "...", "sentence": "...", "explanation": null, '
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
                "required": ["ref", "evidenceIds"],
                "properties": {
                    "ref": {"type": "string"},
                    "sentence": {"type": ["string", "null"]},
                    "explanation": {"type": ["string", "null"]},
                    "evidenceIds": {"type": "array", "items": {"type": "string"}},
                },
            },
        }
    },
}


def _clip(text: str) -> str:
    return text if len(text) <= MAX_SOURCE_CHARS else text[:MAX_SOURCE_CHARS] + "…"


def build_request(summary: SummaryInput) -> LlmRequest:
    lines = [
        f"회사: {summary.company_name}",
        f"이전 보고서: {summary.previous_report}",
        f"현재 보고서: {summary.current_report}",
    ]
    if summary.text_items:
        lines += [
            "",
            "[문장 변화] 항목마다 무엇이 바뀌었는지 한 문장으로 sentence에 씁니다. "
            "explanation은 null입니다.",
        ]
        for item in summary.text_items:
            label = CHANGE_LABELS.get(item.change_type, item.change_type)
            lines.append(f"- ref {item.ref} · {label} · 항목: {item.section_path}")
            for source in item.sources:
                lines.append(disclosure(source.evidence_id, _clip(source.text)))
    explained = [i for i in summary.financial_items if i.candidates]
    if explained:
        lines += [
            "",
            "[재무 수치 변화의 설명] 계정 변화를 회사가 설명한 문장이 후보 원문에 있으면 "
            "explanation에 한 문장으로 요약합니다. 후보 원문이 그 변화를 설명하지 않으면 "
            "explanation을 null로, evidenceIds를 빈 배열로 둡니다. sentence는 null입니다. "
            "수치는 코드가 계산해 따로 보여 주므로 다시 쓰지 않습니다.",
        ]
        for item in explained:
            direction = {"UP": "증가", "DOWN": "감소"}.get(item.direction or "", "변화")
            lines.append(f"- ref {item.ref} · {item.account_name} {direction}")
            for source in item.candidates:
                lines.append(
                    disclosure(source.evidence_id, _clip(source.text), source.section_path)
                )
    return LlmRequest(
        task=TASK,
        prompt_version=PROMPT_VERSION,
        system=SYSTEM,
        user="\n".join(lines),
        output_schema=OUTPUT_SCHEMA,
        context=summary,
    )
