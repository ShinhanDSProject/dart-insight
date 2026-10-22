"""변경 항목 우선순위(2.6). 확인할 순서를 정하는 규칙이며 투자 판단이 아니다.

결정 로그 '공시 변화 평가 규칙과 중립·판단 유보 도입 여부'가 정해지기 전까지 쓰는
잠정 규칙이다(PRIORITY_VERSION).
점수는 아래 규칙을 더한 값이고, 적용한 규칙을 이유로 함께 남긴다. 숫자는 코드가 계산한다.

- 섹션: 사업의 내용·경영진단·투자자 보호·대주주 거래처럼 사업 내용과 위험을 적는 섹션을 먼저 본다.
- 변경 유형: 문장이 새로 들어가거나 빠진 것을 고친 것보다 먼저 본다. 크게 고친 것은 조금 더 앞에.
- 블록: 문단을 표보다 먼저 본다. 숫자만 바뀐 표·문단은 재무 수치 탭과 겹쳐 뒤로 미룬다.
- 핵심어: 소송·제재·합병처럼 확인이 필요한 사건을 가리키는 말이 바뀐 글에 있으면 앞으로.
- 검토 필요(두 보고서의 항목을 짝짓지 못함)는 규칙으로 판단할 수 없어
  순위를 매기지 않는다(판단 유보).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.compare.text_diff import (
    ADDED,
    DELETED,
    MODIFIED,
    REVIEW_NEEDED,
    Change,
    title_key,
)

PRIORITY_VERSION = "priority-1"

HIGH = "HIGH"
MEDIUM = "MEDIUM"
LOW = "LOW"
UNRANKED = "UNRANKED"

HIGH_FROM = 60
MEDIUM_FROM = 30

# (섹션 이름에 들어 있는 말, 점수, 이유). 경로의 어느 섹션에든 있으면 가장 높은 것 하나만 쓴다.
SECTION_RULES: list[tuple[str, int, str]] = [
    ("사업의내용", 30, "사업의 내용 섹션"),
    ("경영진단", 25, "경영진단 및 분석의견 섹션"),
    ("투자자보호", 25, "투자자 보호 사항 섹션"),
    ("우발", 25, "우발부채 관련 섹션"),
    ("소송", 25, "소송 관련 섹션"),
    ("대주주", 20, "대주주 등과의 거래 섹션"),
    ("특수관계", 20, "특수관계자 거래 섹션"),
    ("재무에관한사항", 10, "재무에 관한 사항 섹션"),
]
DEFAULT_SECTION = (5, "그 밖의 섹션")

# 확인이 필요한 사건을 가리키는 말(중립적인 사실 표현만. 좋고 나쁨을 판단하지 않는다)
KEYWORDS = [
    "소송",
    "분쟁",
    "제재",
    "과징금",
    "우발",
    "채무보증",
    "담보",
    "손상",
    "중단",
    "철수",
    "매각",
    "인수",
    "합병",
    "분할",
    "유상증자",
    "감자",
    "최대주주",
    "횡령",
    "배임",
    "리콜",
    "해지",
    "특수관계자",
    "신규",
    "증설",
    "폐쇄",
]
KEYWORD_SCORE = 15
KEYWORD_LIMIT = 2


@dataclass(frozen=True)
class Priority:
    level: str
    score: int | None
    reasons: list[str]


def section_rule(section_path: str) -> tuple[int, str]:
    keys = [title_key(part) for part in section_path.split(" > ")]
    best = DEFAULT_SECTION
    for word, score, reason in SECTION_RULES:
        if any(word in key for key in keys) and score > best[0]:
            best = (score, reason)
    return best


def prioritize(change: Change, previous_text: str | None, current_text: str | None) -> Priority:
    if change.change_type == REVIEW_NEEDED:
        return Priority(
            UNRANKED, None, ["두 보고서의 항목을 짝짓지 못해 순위를 매기지 않음(판단 유보)"]
        )

    score, reason = section_rule(change.section_path)
    reasons = [f"{reason} +{score}"]

    if change.change_type in (ADDED, DELETED):
        score += 20
        reasons.append(("문장·표 추가" if change.change_type == ADDED else "문장·표 삭제") + " +20")
    elif change.change_type == MODIFIED:
        score += 10
        reasons.append("수정 +10")
        if change.similarity is not None and change.similarity < 0.7 and not change.numbers_only:
            score += 10
            reasons.append("크게 바뀜(비슷한 정도 0.7 미만) +10")

    if change.block_type == "PARAGRAPH":
        score += 10
        reasons.append("문단 +10")

    if change.numbers_only:
        score -= 30
        reasons.append("숫자만 바뀜(재무 수치 탭과 겹침) -30")

    changed = _changed_text(change.change_type, previous_text, current_text)
    hits = [word for word in KEYWORDS if word in changed][:KEYWORD_LIMIT]
    for word in hits:
        score += KEYWORD_SCORE
        reasons.append(f"핵심어 '{word}' +{KEYWORD_SCORE}")

    score = max(score, 0)
    level = HIGH if score >= HIGH_FROM else MEDIUM if score >= MEDIUM_FROM else LOW
    return Priority(level, score, reasons)


def _changed_text(change_type: str, previous: str | None, current: str | None) -> str:
    """핵심어를 찾을 글. 수정이면 새로 들어간 낱말만 본다(원래 있던 말로 순위가 오르지 않게)."""
    if change_type == ADDED:
        return current or ""
    if change_type == DELETED:
        return previous or ""
    before = set((previous or "").split())
    return " ".join(word for word in (current or "").split() if word not in before)
