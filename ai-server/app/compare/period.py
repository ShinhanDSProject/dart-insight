"""보고서 기간 표시만 바뀐 글 찾기(3.56). 목록 분류(listing.py)의 PERIOD 묶음이 쓴다.

정기보고서는 해마다 기수(제57기 → 제58기), 연도, 기준일이 저절로 바뀐다. 두 원문의 표지에서
기수와 사업연도(시작·끝 날짜)를 읽어 두 보고서의 기간 차이를 정하고, 수정된 글의 다른 곳이
모두 그 차이만큼 바뀐 기간 표시뿐이면 기간 표시만 바뀐 글로 본다. 잠정 규칙이다(LIST_VERSION).

- 기간 표시는 세 가지뿐이다: 기수가 기수 차이만큼, 연도가 연도 차이만큼(월·일은 같음) 바뀐 것,
  이전 보고서의 사업연도 시작·끝 날짜가 현재 보고서의 시작·끝 날짜로 바뀐 것.
- 그 밖의 숫자·글자가 하나라도 다르거나, 사건을 말하는 낱말이 있으면 해당하지 않는다.
  예: '제55기 정기주주총회(2024년 3월 20일)'가 '제57기 …(2026년 3월 18일)'로 바뀐 정관 이력.
- 표지에서 기수나 사업연도를 찾지 못하면 아무것도 기간 표시만 바뀐 글로 보지 않는다.
LLM을 쓰지 않고, 좋고 나쁨을 판단하지 않는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.compare.text_diff import DocumentIn

# 기수(제 57 기), 날짜(2025년 6월 30일, 2025년 6월, 2025년, 2025.06.30·2025-06-30·2025/06/30)
_TOKEN = re.compile(
    r"제\s*(?P<term>\d+)\s*기"
    r"|(?<!\d)(?P<year>\d{4})\s*(?:"
    r"년(?:\s*(?P<month>\d{1,2})\s*월(?:\s*(?P<day>\d{1,2})\s*일)?)?"
    r"|[.\-/]\s*(?P<month2>\d{1,2})\s*[.\-/]\s*(?P<day2>\d{1,2})(?!\d)"
    r")"
)
# 표지의 사업연도: '사업연도 | 2025년 01월 01일 | 부터 2025년 06월 30일 | 까지'
_FISCAL_PERIOD = re.compile(r"사업연도(.*?)까지", re.DOTALL)
# 사건을 말하는 낱말. 기수가 회차를 가리킬 수 있어(정기주주총회 등) 있으면 기간 표시로 보지 않는다
_EVENT_WORDS = re.compile(
    "주주총회|총회|이사회|결의|선임|해임|취임|사임|정관|계약|소송|판결|제재|합병|인수|취득|처분"
)
_SPACE = re.compile(r"\s+")

TERM = "TERM"
DATE = "DATE"


@dataclass(frozen=True)
class _Token:
    kind: str
    # 기수면 (번호,), 날짜면 (연, 월, 일). 쓰지 않은 월·일은 0
    value: tuple[int, ...]


@dataclass(frozen=True)
class PeriodShift:
    """두 보고서의 기간 차이. 날짜 쌍은 (이전, 현재) 사업연도 시작·끝이다."""

    terms: int
    years: int
    date_pairs: frozenset[tuple[tuple[int, ...], tuple[int, ...]]]


def period_shift(previous: DocumentIn, current: DocumentIn) -> PeriodShift | None:
    """두 원문 표지의 기수·사업연도로 기간 차이를 정한다. 하나라도 못 읽으면 None."""
    before, after = _cover_period(previous), _cover_period(current)
    if before is None or after is None:
        return None
    (term_before, start_before, end_before) = before
    (term_after, start_after, end_after) = after
    return PeriodShift(
        terms=term_after - term_before,
        years=end_after[0] - end_before[0],
        date_pairs=frozenset({(start_before, start_after), (end_before, end_after)}),
    )


def period_only(previous: str, current: str, shift: PeriodShift) -> bool:
    """두 글이 기간 차이만큼 바뀐 기간 표시 말고는 같은지. 바뀐 기간 표시가 하나도 없으면 False."""
    if _EVENT_WORDS.search(previous) or _EVENT_WORDS.search(current):
        return False
    if _masked(previous) != _masked(current):
        return False
    before, after = _tokens(previous), _tokens(current)
    if len(before) != len(after):
        return False
    shifted = False
    for a, b in zip(before, after, strict=True):
        if a == b:
            continue
        if not _is_shifted(a, b, shift):
            return False
        shifted = True
    return shifted


def _is_shifted(a: _Token, b: _Token, shift: PeriodShift) -> bool:
    if a.kind != b.kind:
        return False
    if a.kind == TERM:
        return b.value[0] - a.value[0] == shift.terms
    year, month, day = a.value
    if (year + shift.years, month, day) == b.value:
        return True
    return (a.value, b.value) in shift.date_pairs


def _cover_period(document: DocumentIn) -> tuple[int, tuple[int, ...], tuple[int, ...]] | None:
    """표지 글에서 (기수, 사업연도 시작, 끝)."""
    cover = {s.section_no for s in document.sections if s.cover}
    text = "\n".join(b.text for b in document.blocks if b.section_no in cover)
    term = next((t for t in _tokens(text) if t.kind == TERM), None)
    period = _FISCAL_PERIOD.search(text)
    if term is None or period is None:
        return None
    dates = [t.value for t in _tokens(period.group(1)) if t.kind == DATE and 0 not in t.value]
    if len(dates) != 2:
        return None
    return term.value[0], dates[0], dates[1]


def _tokens(text: str) -> list[_Token]:
    tokens: list[_Token] = []
    for m in _TOKEN.finditer(text):
        if m.group("term") is not None:
            tokens.append(_Token(TERM, (int(m.group("term")),)))
            continue
        month = m.group("month") or m.group("month2")
        day = m.group("day") or m.group("day2")
        tokens.append(_Token(DATE, (int(m.group("year")), int(month or 0), int(day or 0))))
    return tokens


def _masked(text: str) -> str:
    """기간 표시를 가리고 띄어쓰기를 뺀 글"""
    return _SPACE.sub("", _TOKEN.sub("\0", text))
