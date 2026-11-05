"""외화 금액을 원화로 바꾸기(2.16, ADR-0053).

환율은 그 공시 글에 적힌 값, 저장소 환율표(fx_rates.csv, 보고서 기준일) 순서로 쓴다.
둘 다 없으면 원화 금액을 모른다. 환율표 값은 담당자가 한국은행 ECOS에서 확인해 넣는다.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache
from pathlib import Path

from app.events.amounts import KRW

DISCLOSED_RATE = "disclosed_rate"
REFERENCE_TABLE = "reference_table"
FX_NONE = "none"

RATES_FILE = Path(__file__).with_name("fx_rates.csv")

Rates = dict[tuple[str, str], Decimal]


@dataclass(frozen=True)
class Converted:
    krw: int | None
    source: str | None = None
    rate_date: str | None = None


@lru_cache(maxsize=1)
def load_rates(path: Path = RATES_FILE) -> Rates:
    """(통화, 기준일) → 1단위의 원화. 값이 빈 줄은 건너뛴다. 파일은 한 번만 읽는다.

    잘못 적은 줄은 예외가 난다. 저장소 파일은 테스트가 읽어 보므로 CI에서 먼저 걸린다.
    """
    with path.open(encoding="utf-8", newline="") as file:
        return {
            (row["currency"], row["base_date"]): Decimal(row["rate"]) / Decimal(row["unit"])
            for row in csv.DictReader(file)
            if row["rate"].strip()
        }


def _won(value: Decimal) -> int:
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def to_krw(
    currency: str,
    value: Decimal,
    disclosed: dict[str, Decimal],
    base_date: str | None,
    table: Rates,
) -> Converted:
    if currency == KRW:
        return Converted(_won(value))
    if currency in disclosed:
        return Converted(_won(value * disclosed[currency]), DISCLOSED_RATE)
    rate = table.get((currency, base_date)) if base_date else None
    if rate is not None:
        return Converted(_won(value * rate), REFERENCE_TABLE, base_date)
    return Converted(None, FX_NONE)
