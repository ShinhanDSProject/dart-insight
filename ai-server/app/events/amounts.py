"""사건 글에서 금액 후보 뽑기(2.16, ADR-0053). LLM을 쓰지 않는 순수 함수다.

숫자는 여기서만 만든다. AI는 이 후보가 사건의 금액인지 번호로만 답한다(amount_pick.py).
- 단위: 원·천원·만원·백만원·억원·조원.
- 표는 표 안이나 바로 앞 블록의 '단위'가 돈일 때만 숫자 칸을 읽는다.
- 주당·액면 금액과 환율 표기는 후보에서 빼고 이유를 남긴다. 환율 표기는 공시 환율로 보관한다.
- 외화(USD·EUR·JPY·CNY)는 후보에 남긴다. 환산은 fx.py가 한다.
- 금액 가까이에 합계·누계·한도·총액이 있으면 표시한다. 같은 통화·같은 값은 처음 것만 남긴다.
- 문맥은 금액이 있는 문장이나 표의 행 전체다(ADR-0058).

결과가 달라지게 바꾸면 backend TextEvents.EVENT_VERSION을 올린다.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from decimal import Decimal
from itertools import takewhile

KRW = "KRW"
USD = "USD"
EUR = "EUR"
JPY = "JPY"
CNY = "CNY"

# 후보에서 뺀 이유
PER_SHARE = "PER_SHARE"
FX_RATE_TEXT = "FX_RATE_TEXT"
UNREADABLE = "UNREADABLE"

# 긴 문장에서 금액 앞뒤로 보여 줄 글자 수
_CONTEXT_CHARS = 200
_BEFORE_CHARS = 20
_TOTAL_BEFORE_CHARS = 8
_TOTAL_AFTER_CHARS = 6

_UNITS = {
    "조": Decimal(10**12),
    "십억": Decimal(10**9),
    "억": Decimal(10**8),
    "천만": Decimal(10**7),
    "백만": Decimal(10**6),
    "만": Decimal(10**4),
    "천": Decimal(10**3),
    "billion": Decimal(10**9),
    "million": Decimal(10**6),
    "thousand": Decimal(10**3),
}
_CURRENCY_WORDS = {
    "원": KRW,
    "USD": USD,
    "US$": USD,
    "$": USD,
    "달러": USD,
    "EUR": EUR,
    "유로": EUR,
    "JPY": JPY,
    "엔": JPY,
    "CNY": CNY,
    "RMB": CNY,
    "위안": CNY,
}

_NUM = r"\d[\d,]*(?:\.\d+)?"
_KR_UNIT = "조|억|천만|백만|만|천"
_CODES = "USD|EUR|JPY|CNY"
_RATE_WORDS = f"{_CODES}|달러|유로|엔|위안"

_PIECE = re.compile(rf"({_NUM})\s*({_KR_UNIT})?")
_WON = re.compile(
    rf"(?<![\d.,])(?:(?:{_NUM}\s*(?:{_KR_UNIT})\s*)+(?:{_NUM}\s*)?|{_NUM}\s*)원(?![칙인자본문회료])"
)
_FOREIGN_PREFIX = re.compile(
    rf"(?<![A-Za-z])(USD|US\$|EUR|JPY|CNY|RMB|\$)\s*({_NUM})\s*"
    r"(십억|백만|천만|억|만|천|million|billion|thousand)?",
    re.IGNORECASE,
)
_FOREIGN_SUFFIX = re.compile(
    rf"(?<![\d.,])({_NUM})\s*(십억|백만|천만|억|만|천)?\s*"
    r"(달러|USD|유로|EUR|위안|CNY|JPY|엔(?![가-힣])|엔(?=[을를이가의은는에과와로도]))"
)

_RATE_PER_UNIT = re.compile(
    rf"(?<![\d.,])(1|100)\s*({_RATE_WORDS})\s*(?:당|=|:)\s*(?:약\s*)?({_NUM})\s*원"
)
_RATE_CODE_FIRST = re.compile(rf"({_CODES})\s*(1|100)\s*[=:]\s*({_NUM})\s*원")
_RATE_PER_SLASH = re.compile(rf"({_NUM})\s*원\s*/\s*({_CODES})")

_PER_SHARE_WORD = re.compile(r"주당|1\s*주|액면|발행가|행사가|전환가|기준주가|공모가")
_PER_SHARE_AFTER = re.compile(r"\s*/\s*주")
_RATE_WORD = re.compile(r"환율")
_TOTAL_WORD = re.compile(r"합계|누계|한도|총액")
_CLAUSE_END = re.compile(r",\s|\.\s|;|\n|\s\|\s")
# 한글 뒤나 쉼표로 묶은 숫자 뒤의 마침표만 문장 끝으로 본다.
# 'sp. z o. o.', 금액의 소수점, '2026. 6. 30.' 같은 날짜에서 끊지 않는다
_SENTENCE_END = re.compile(r"(?<=[가-힣])\.|(?<=,\d{3})\.(?=\s)|\n")

_UNIT_HEAD = re.compile(r"단위\s*[:：]?\s*([^)\]\n|]*)")
_UNIT_MONEY = re.compile(r"(천|백만|억|조|만)?\s*(원|USD|달러|EUR|유로|JPY|엔|CNY|위안)")
_NUMBER_CELL = re.compile(r"\(?-?(\d[\d,]*(?:\.\d+)?)\)?")
_YEAR_CELL = re.compile(r"(?:19|20)\d\d")
_TOTAL_LABEL = re.compile(r"합\s*계|누\s*계|한도|총액")
# 행이 표와 다른 자기 통화·단위를 적은 경우. 예: 출자대금납입 [AUD, 천]
_OWN_UNIT_LABEL = re.compile(r"\[[A-Z]{3}\s*,")
_NOT_AMOUNT_LABEL = re.compile(r"건수|수량|주식수|주수|비율|율|%|명|인원|연도|주당|액면|사망|부상")


@dataclass(frozen=True)
class AmountSource:
    change_no: int
    evidence_id: str
    text: str
    is_table: bool = False
    preceding_text: str | None = None


@dataclass(frozen=True)
class AmountCandidate:
    change_no: int
    evidence_id: str
    text: str
    currency: str
    value: Decimal
    context: str
    from_table: bool
    total_like: bool


@dataclass(frozen=True)
class ExcludedAmount:
    text: str
    reason: str


@dataclass(frozen=True)
class ExtractedAmounts:
    candidates: list[AmountCandidate] = field(default_factory=list)
    excluded: list[ExcludedAmount] = field(default_factory=list)
    disclosed_rates: dict[str, Decimal] = field(default_factory=dict)


def extract_amounts(sources: list[AmountSource]) -> ExtractedAmounts:
    candidates: dict[tuple[str, Decimal], AmountCandidate] = {}
    excluded: list[ExcludedAmount] = []
    rates: dict[str, Decimal] = {}
    for source in sources:
        masked = _take_rates(source.text, rates, excluded)
        for candidate in _from_written(source, masked, excluded):
            candidates.setdefault((candidate.currency, candidate.value), candidate)
        if source.is_table:
            for candidate in _from_cells(source):
                candidates.setdefault((candidate.currency, candidate.value), candidate)
    return ExtractedAmounts(list(candidates.values()), excluded, rates)


def _number(text: str) -> Decimal:
    return Decimal(text.replace(",", ""))


def _take_rates(text: str, rates: dict[str, Decimal], excluded: list[ExcludedAmount]) -> str:
    """환율 표기를 보관하고, 금액으로 읽지 않게 공백으로 가린 글을 돌려준다."""

    def keep(currency_word: str, per: str, rate: str) -> None:
        currency = _CURRENCY_WORDS[currency_word]
        rates.setdefault(currency, _number(rate) / Decimal(per))

    def replace_with(match: re.Match[str], currency: str, per: str, rate: str) -> str:
        keep(currency, per, rate)
        excluded.append(ExcludedAmount(match.group(0), FX_RATE_TEXT))
        return " " * len(match.group(0))

    text = _RATE_PER_UNIT.sub(lambda m: replace_with(m, m.group(2), m.group(1), m.group(3)), text)
    text = _RATE_CODE_FIRST.sub(lambda m: replace_with(m, m.group(1), m.group(2), m.group(3)), text)
    return _RATE_PER_SLASH.sub(lambda m: replace_with(m, m.group(2), "1", m.group(1)), text)


def _won_value(text: str) -> Decimal | None:
    """단위가 큰 것부터 적힌 표기만 읽는다(1조 2,000억원). 아니면 None(3천5백만원)."""
    total = Decimal(0)
    last_unit: Decimal | None = None
    for number, unit in _PIECE.findall(text):
        size = _UNITS[unit] if unit else Decimal(1)
        if last_unit is not None and size >= last_unit:
            return None
        total += _number(number) * size
        last_unit = size
    return total


def _clause(text: str, start: int, end: int) -> tuple[str, str]:
    """금액 앞뒤의 같은 구절."""
    before = text[:start]
    breaks = list(_CLAUSE_END.finditer(before))
    if breaks:
        before = before[breaks[-1].end() :]
    after = text[end:]
    first = _CLAUSE_END.search(after)
    if first:
        after = after[: first.start()]
    return before, after


def _exclusion(before: str, after: str) -> str | None:
    near = before[-_BEFORE_CHARS:]
    if _RATE_WORD.search(near):
        return FX_RATE_TEXT
    if _PER_SHARE_WORD.search(near) or _PER_SHARE_AFTER.match(after):
        return PER_SHARE
    return None


def _context(text: str, start: int, end: int) -> str:
    """금액이 있는 문장이나 표의 행. 너무 길면 앞뒤를 자른다."""
    ends_before = list(_SENTENCE_END.finditer(text, 0, start))
    first = ends_before[-1].end() if ends_before else 0
    next_end = _SENTENCE_END.search(text, end)
    last = len(text)
    if next_end:
        last = next_end.end() if next_end.group(0) == "." else next_end.start()
    return text[max(first, start - _CONTEXT_CHARS) : min(last, end + _CONTEXT_CHARS)].strip()


def _from_written(
    source: AmountSource, text: str, excluded: list[ExcludedAmount]
) -> Iterator[AmountCandidate]:
    """글에 단위까지 적힌 금액."""
    for start, end, currency, value in _written_amounts(text):
        before, after = _clause(text, start, end)
        written = text[start:end].strip()
        label = _row_label(text, start) if source.is_table else ""
        reason = UNREADABLE if value is None else _exclusion(before, after)
        if reason is None and _PER_SHARE_WORD.search(label):
            reason = PER_SHARE
        if reason or value is None:
            excluded.append(ExcludedAmount(written, reason or UNREADABLE))
            continue
        total_like = bool(
            _TOTAL_WORD.search(before[-_TOTAL_BEFORE_CHARS:])
            or _TOTAL_WORD.search(after[:_TOTAL_AFTER_CHARS])
            or _TOTAL_LABEL.fullmatch(label)
        )
        yield AmountCandidate(
            source.change_no,
            source.evidence_id,
            written,
            currency,
            value,
            _context(source.text, start, end),
            source.is_table,
            total_like,
        )


def _row_label(text: str, start: int) -> str:
    """금액이 있는 행의 첫 칸. 금액이 첫 칸 안에 있으면 빈 글."""
    line_start = text.rfind("\n", 0, start) + 1
    label, bar, _ = text[line_start:start].partition("|")
    return label.strip() if bar else ""


def _written_amounts(text: str) -> list[tuple[int, int, str, Decimal | None]]:
    found: list[tuple[int, int, str, Decimal | None]] = [
        (m.start(), m.end(), KRW, _won_value(m.group(0))) for m in _WON.finditer(text)
    ]
    for match in _FOREIGN_PREFIX.finditer(text):
        unit = (match.group(3) or "").lower()
        size = _UNITS[unit] if unit else Decimal(1)
        currency = _CURRENCY_WORDS[match.group(1).upper()]
        found.append((match.start(), match.end(), currency, _number(match.group(2)) * size))
    for match in _FOREIGN_SUFFIX.finditer(text):
        size = _UNITS[match.group(2)] if match.group(2) else Decimal(1)
        currency = _CURRENCY_WORDS[match.group(3)]
        found.append((match.start(), match.end(), currency, _number(match.group(1)) * size))
    found.sort(key=lambda item: (item[0], -item[1]))
    kept: list[tuple[int, int, str, Decimal | None]] = []
    for item in found:
        if not kept or item[0] >= kept[-1][1]:
            kept.append(item)
    return kept


def _table_unit(source: AmountSource) -> tuple[str, str, Decimal] | None:
    """(적힌 단위, 통화, 배수). 표 안을 먼저 보고 없으면 바로 앞 블록을 본다. 돈이 아니면 None."""
    for text in (source.text, source.preceding_text or ""):
        head = _UNIT_HEAD.search(text)
        money = _UNIT_MONEY.search(head.group(1)) if head else None
        if money:
            size = _UNITS[money.group(1)] if money.group(1) else Decimal(1)
            return money.group(0).replace(" ", ""), _CURRENCY_WORDS[money.group(2)], size
    return None


def _from_cells(source: AmountSource) -> Iterator[AmountCandidate]:
    """단위가 돈인 표의 숫자 칸."""
    unit = _table_unit(source)
    if unit is None:
        return
    written_unit, currency, size = unit
    rows = [
        [cell.strip() for cell in line.split("|")]
        for line in source.text.splitlines()
        if "|" in line
    ]
    header_rows = list(takewhile(lambda row: not any(map(_is_number, row)), rows))
    for row in rows[len(header_rows) :]:
        if _OWN_UNIT_LABEL.search(row[0]):
            continue
        for column, cell in enumerate(row[1:], start=1):
            heads = _column_heads(header_rows, len(row), column)
            value = _cell_value(cell, " ".join([row[0], *heads]))
            if value is None:
                continue
            written = f"{cell} (단위: {written_unit})"
            yield AmountCandidate(
                source.change_no,
                source.evidence_id,
                written,
                currency,
                value * size,
                f"{_row_around(row, column)} (칸: {', '.join([*heads, written])})",
                True,
                any(_TOTAL_LABEL.fullmatch(label) for label in [row[0], *heads]),
            )


def _row_around(row: list[str], column: int) -> str:
    """그 칸이 있는 행. 너무 길면 칸의 앞뒤를 자른다."""
    text = " | ".join(row)
    start = len(" | ".join(row[: column + 1])) - len(row[column])
    return text[max(0, start - _CONTEXT_CHARS) : start + len(row[column]) + _CONTEXT_CHARS]


def _is_number(cell: str) -> bool:
    return _NUMBER_CELL.fullmatch(cell) is not None


def _column_heads(header_rows: list[list[str]], width: int, column: int) -> list[str]:
    """그 칸 위의 머리글. 머리 행이 짧으면 왼쪽 칸이 병합된 것으로 보고 오른쪽을 맞춘다."""
    heads = []
    for head in header_rows:
        index = column - max(0, width - len(head))
        if 0 <= index < len(head) and head[index]:
            heads.append(head[index])
    return heads


def _cell_value(cell: str, label: str) -> Decimal | None:
    number = _NUMBER_CELL.fullmatch(cell)
    if number is None or _YEAR_CELL.fullmatch(cell):
        return None
    if _NOT_AMOUNT_LABEL.search(label) or _PER_SHARE_WORD.search(label):
        return None
    value = _number(number.group(1))
    return value if value > 0 else None
