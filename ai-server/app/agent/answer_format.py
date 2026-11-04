"""답 형식(docs/api-spec.md 공개 API `format`, #581 AC24).

CHAT은 대화 답(해요체 3문장, 400자 이내), BRIEF는 사용자가 정리 형식("3줄 요약", "IR용 정리",
"확인할 점")을 요청한 답(1,500자 이내, 줄마다 근거 표시)이다. 형식은 사용자 메시지로 코드가 정하고
(LLM이 정하지 않음), 같은 검토 노드를 거친다.
"""

from __future__ import annotations

import re

from app.agent.model import FORMAT_BRIEF, FORMAT_CHAT

MAX_CHAT = 400
MAX_BRIEF = 1500

# 정리 형식을 요청하는 말(공백을 뺀 메시지에서 찾음)
_BRIEF_REQUEST = re.compile(
    r"\d+줄(?:로)?(?:요약|정리)|요약.{0,4}\d+줄|ir용|요점(?:만)?(?:정리|요약)?|확인할점|체크리스트"
    r"|정리해(?:줘|주세요|줄래)|목록으로|항목별로"
)

_LINE_COUNT = re.compile(r"(\d+)줄")

FORMAT_INSTRUCTIONS = {
    FORMAT_CHAT: (
        f"[형식] CHAT: '~어요'로 끝나는 해요체로 3문장 이내, {MAX_CHAT}자 이내로 답합니다."
    ),
    FORMAT_BRIEF: (
        "[형식] BRIEF: 사용자가 정리 형식을 요청했습니다. "
        "한 줄에 한 가지 내용을 '- '로 시작해 쓰고, 줄마다 끝에 근거 표시를 붙입니다. "
        "줄 수를 정했으면(예: '3줄') 그 줄 수로 씁니다. "
        "굵게(**)·제목(#) 같은 마크다운 꾸밈은 쓰지 않습니다. "
        f"'~어요'로 끝나는 해요체로, 모두 {MAX_BRIEF}자 이내로 씁니다."
    ),
}


def answer_format(message: str) -> str:
    """사용자 메시지로 정한 답 형식."""
    compact = re.sub(r"\s+", "", message).lower()
    return FORMAT_BRIEF if _BRIEF_REQUEST.search(compact) else FORMAT_CHAT


def requested_lines(message: str) -> int | None:
    """사용자가 정한 줄 수('3줄 요약', '요약 5줄'). 정하지 않았으면 None."""
    found = _LINE_COUNT.search(re.sub(r"\s+", "", message))
    return int(found.group(1)) if found else None


def max_answer(fmt: str) -> int:
    return MAX_BRIEF if fmt == FORMAT_BRIEF else MAX_CHAT
