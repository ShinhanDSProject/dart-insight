"""사건 제목의 금액·날짜·사건번호·회사 이름·건수·비율을 원문과 대조한다(2.15).

모델이 쓴 글에 있는 사실이 그 사건의 변경 글에 있어야 한다. 표기가 달라도 되는 것은 날짜뿐이고,
나머지는 띄어쓰기와 쉼표만 빼고 같아야 한다. 건수와 비율은 코드가 세므로 모델이 세어 쓴 값을
막으려고 단위까지 함께 본다.

회사 이름은 글로 알아볼 수 있는 것만 본다: ㈜·(주)·주식회사 표시, 영문 낱말,
업종 낱말로 끝나는 이름. 표시 없는 이름(예: 영풍)은 찾지 못한다.

결과가 달라지게 바꾸면 app/events/prompt.py의 PROMPT_VERSION을 올린다.
"""

from __future__ import annotations

import re

from app.llm.grounding import number_problem

_SOURCE_KEY = "source"
_SQUEEZE = re.compile(r"[\s,]")

_KOREAN_DATE = re.compile(r"(\d{4})\s*년\s*(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일)?")
_DOTTED_DATE = re.compile(r"(?<![\d.])(\d{4})[.\-/](\d{1,2})(?:[.\-/](\d{1,2}))?(?!\d)")
_MONTH_DAY = re.compile(r"(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일")

# 예: 2025가합12345. 날짜와 단위가 붙은 수는 사건번호가 아니다
_CASE_NO = re.compile(r"\d{4}\s*(?:(?![년월일조억만천원건명개주])[가-힣]){1,3}\s*\d+")
_COUNT_OR_RATIO = re.compile(
    r"\d[\d,]*(?:\.\d+)?\s*(?:건|%|퍼센트)"
    r"|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|여러|수십|수백)\s*건(?![가-힣])"
)

_NAME = r"[가-힣A-Za-z0-9&]+"
_NAME_THEN_MARK = re.compile(rf"({_NAME})(?:㈜|\(주\)|\s*주식회사)")
_MARK_THEN_NAME = re.compile(rf"(?:㈜|\(주\)|주식회사)\s*({_NAME})")
_INDUSTRY_NAME = re.compile(
    rf"{_NAME}(?:증권|은행|전자|건설|화학|물산|생명|보험|캐피탈|자산운용|파트너스|홀딩스|중공업|제약"
    r"|바이오|회계법인|법무법인)"
)
_LATIN_WORD = re.compile(r"[A-Za-z][A-Za-z0-9&]+")
_PARTICLE = re.compile(r"(?:으로|에게|에서|과의|와의|과|와|의|은|는|이|가|을|를|에|로|도)$")


def fact_problem(text: str, source: str) -> str | None:
    """text의 사실이 source에 없으면 모델에 알려 줄 문장, 모두 있으면 None."""
    return (
        _date_problem(text, source)
        or number_problem(_without_dates(text), {_SOURCE_KEY: source}, [_SOURCE_KEY])
        or _exact_problem(text, source)
        or _company_problem(text, source)
    )


def has_date(text: str) -> bool:
    """연도가 있든 없든 날짜가 적혀 있는지. '일정이 없다'는 문장을 확인할 때 쓴다."""
    return bool(_full_dates(text) or _month_days(text))


def _full_dates(text: str) -> set[tuple[int, int, int | None]]:
    found: set[tuple[int, int, int | None]] = set()
    for pattern in (_KOREAN_DATE, _DOTTED_DATE):
        for year, month, day in pattern.findall(text):
            if 1 <= int(month) <= 12:
                found.add((int(year), int(month), int(day) if day else None))
    return found


def _without_full_dates(text: str) -> str:
    return _DOTTED_DATE.sub(" ", _KOREAN_DATE.sub(" ", text))


def _without_dates(text: str) -> str:
    return _MONTH_DAY.sub(" ", _without_full_dates(text))


def _month_days(text: str) -> set[tuple[int, int]]:
    """연도 없이 쓴 날짜."""
    return {(int(m), int(d)) for m, d in _MONTH_DAY.findall(_without_full_dates(text))}


def _date_problem(text: str, source: str) -> str | None:
    full = _full_dates(source)
    known_month_days = _month_days(source) | {(m, d) for _, m, d in full if d is not None}
    for year, month, day in sorted(_full_dates(text), key=str):
        if day is None:
            found = any(y == year and m == month for y, m, _ in full)
        else:
            found = (year, month, day) in full
        if not found:
            return f"원문에 없는 날짜가 있습니다: {year}년 {month}월. 원문의 날짜만 쓰세요."
    for month, day in sorted(_month_days(text)):
        if (month, day) not in known_month_days:
            return f"원문에 없는 날짜가 있습니다: {month}월 {day}일. 원문의 날짜만 쓰세요."
    return None


def _exact_problem(text: str, source: str) -> str | None:
    squeezed = _SQUEEZE.sub("", source)
    for pattern, label in ((_CASE_NO, "사건번호"), (_COUNT_OR_RATIO, "건수·비율")):
        for match in pattern.finditer(_without_dates(text)):
            if _SQUEEZE.sub("", match.group(0)) not in squeezed:
                return f"원문에 없는 {label}가 있습니다: {match.group(0)}. 원문 표기대로만 쓰세요."
    return None


def _company_names(text: str) -> list[str]:
    names = _NAME_THEN_MARK.findall(text)
    rest = _NAME_THEN_MARK.sub(" ", text)
    names += _MARK_THEN_NAME.findall(rest)
    names += _INDUSTRY_NAME.findall(text)
    names += _LATIN_WORD.findall(text)
    return names


def _company_problem(text: str, source: str) -> str | None:
    squeezed = _SQUEEZE.sub("", source).casefold()
    for name in _company_names(text):
        plain = name.casefold()
        trimmed = _PARTICLE.sub("", plain)
        if trimmed and plain not in squeezed and trimmed not in squeezed:
            return f"원문에 없는 이름이 있습니다: {name}. 원문 표기대로만 쓰세요."
    return None
