from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.events.fx import DISCLOSED_RATE, FX_NONE, REFERENCE_TABLE, load_rates, to_krw

BASE_DATE = "2026-06-30"
TABLE = {("USD", BASE_DATE): Decimal("1400")}


def test_won_is_not_converted() -> None:
    converted = to_krw("KRW", Decimal(5_000), {}, BASE_DATE, TABLE)

    assert converted.krw == 5_000
    assert converted.source is None
    assert converted.rate_date is None


def test_disclosed_rate_comes_before_table() -> None:
    converted = to_krw("USD", Decimal(100), {"USD": Decimal("1460.60")}, BASE_DATE, TABLE)

    assert converted.krw == 146_060
    assert converted.source == DISCLOSED_RATE
    assert converted.rate_date is None


def test_reference_table_is_used_for_report_base_date() -> None:
    converted = to_krw("USD", Decimal(11_800_000), {}, BASE_DATE, TABLE)

    assert converted.krw == 16_520_000_000
    assert converted.source == REFERENCE_TABLE
    assert converted.rate_date == BASE_DATE


@pytest.mark.parametrize(
    ("currency", "base_date"),
    [("EUR", BASE_DATE), ("USD", "2025-12-31"), ("USD", None)],
)
def test_no_rate_leaves_won_amount_unknown(currency: str, base_date: str | None) -> None:
    converted = to_krw(currency, Decimal(100), {}, base_date, TABLE)

    assert converted.krw is None
    assert converted.source == FX_NONE
    assert converted.rate_date is None


def test_krw_is_rounded_half_up() -> None:
    assert to_krw("USD", Decimal("1.5"), {"USD": Decimal("1")}, None, {}).krw == 2


def test_load_rates_skips_blank_rates_and_divides_by_unit(tmp_path: Path) -> None:
    path = tmp_path / "rates.csv"
    path.write_text(
        "currency,base_date,unit,rate,source\n"
        "USD,2026-06-30,1,1400.5,ECOS\n"
        "JPY,2026-06-30,100,950,ECOS\n"
        "EUR,2026-06-30,1,,ECOS\n",
        encoding="utf-8",
    )

    assert load_rates(path) == {
        ("USD", "2026-06-30"): Decimal("1400.5"),
        ("JPY", "2026-06-30"): Decimal("9.5"),
    }


def test_repository_table_has_no_rate_until_person_fills_it() -> None:
    assert load_rates() == {}


def test_repository_table_rows_are_for_report_base_date() -> None:
    table = Path("app/events/fx_rates.csv").read_text(encoding="utf-8").splitlines()

    assert table[0] == "currency,base_date,unit,rate,source"
    assert {line.split(",")[0] for line in table[1:]} == {"USD", "EUR", "JPY", "CNY"}
    assert all(date.fromisoformat(line.split(",")[1]) for line in table[1:])
