"""재무 설명의 원인 표현 검사(ADR-0015).

원인 표현은 회사가 원인을 직접 밝힌 설명(STATED)에만 쓸 수 있다. STATED가 아닌 설명에 있으면
관련 문단을 원인처럼 읽히게 쓴 것이라 다시 생성한다. 화면 노출 규정(app.compliance)이 아니라
등급 규칙이라 summary 패키지에 둔다.

목록은 명백한 인과만 담는다. '에 따라'·'기여'·'견인' 같은 간접 인과는 넣지 않는다(10/23 결정).
평가용 정답 자료(#56)로 빠진 문장이 보이면 넓힌다.
"""

from __future__ import annotations

import re

# 등급 규칙(이 원인 표현 목록과 validate.py의 강등 규칙)을 결과가 달라지게 바꾸면
# 이 버전과 backend Analysis.CURRENT_VERSION을 함께 올린다
GRADE_RULES_VERSION = "grade-1"

CAUSAL_CLAIM = "CAUSAL_CLAIM"

PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p)
    for p in (
        r"때문",
        r"탓",
        r"덕분",
        r"(?:으로|로)\s*인(?:해|하여|한)",
        r"에\s*기인",
        r"영향으로",
        r"영향을\s*받아",
        r"결과로",
    )
)


def find(text: str | None) -> str | None:
    """처음 걸린 원인 표현. 없으면 None."""
    if not text:
        return None
    for pattern in PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(0)
    return None
