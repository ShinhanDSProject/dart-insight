"""신호 기준표(app/events/signal_table.json, 7.8)의 모양 확인."""

import json
from pathlib import Path

TABLE = json.loads(
    (Path(__file__).parents[2] / "app" / "events" / "signal_table.json").read_text(encoding="utf-8")
)
SIGNALS = {"POSITIVE", "CAUTION", "MIXED", None}
FRONT_KINDS = [
    "감사의견 비적정",
    "계속기업 불확실성",
    "회생절차",
    "영업정지",
    "횡령·배임",
    "부도발생",
    "해산사유 발생",
    "채권은행 등의 관리절차 개시",
]


def test_kind_codes_and_names_are_unique():
    kinds = TABLE["kinds"]
    assert len({k["code"] for k in kinds}) == len(kinds)
    assert len({k["name"] for k in kinds}) == len(kinds)


def test_change_codes_are_unique_within_a_kind_and_signals_are_known():
    for kind in TABLE["kinds"]:
        codes = [c["code"] for c in kind["changes"]]
        assert codes and len(set(codes)) == len(codes), kind["code"]
        assert {c["signal"] for c in kind["changes"]} <= SIGNALS, kind["code"]


def test_front_kinds_are_the_eight_from_the_7_6_readme_in_order():
    assert [k["name"] for k in TABLE["kinds"] if k["front"]] == FRONT_KINDS


def test_front_kinds_turn_to_caution_when_newly_occurred():
    for kind in TABLE["kinds"]:
        if kind["front"]:
            occurred = next(c for c in kind["changes"] if c["code"] == "OCCURRED")
            assert occurred["signal"] == "CAUTION", kind["code"]


def test_kinds_with_mixed_changes_have_general_good_and_bad_sides():
    for kind in TABLE["kinds"]:
        mixed = any(c["signal"] == "MIXED" for c in kind["changes"])
        sides = kind.get("generalSides")
        assert mixed == (sides is not None), kind["code"]
        if sides:
            assert sides["good"] and sides["bad"]


def test_sanction_and_contract_follow_the_spec_examples():
    """기획서 AC12: 제재 새로 발생은 주의, 취소는 긍정, 신규 계약은 긍정, 계약 해지는 주의."""
    signal = {
        (k["code"], c["code"]): c["signal"] for k in TABLE["kinds"] for c in k["changes"]
    }
    assert signal[("SANCTION", "OCCURRED")] == "CAUTION"
    assert signal[("SANCTION", "CANCELLED")] == "POSITIVE"
    assert signal[("MAJOR_CONTRACT", "NEW")] == "POSITIVE"
    assert signal[("MAJOR_CONTRACT", "TERMINATED")] == "CAUTION"


def test_other_kind_exists_without_a_signal():
    other = next(k for k in TABLE["kinds"] if k["code"] == "OTHER")
    assert [c["signal"] for c in other["changes"]] == [None]


def test_resolving_changes_of_front_kinds_and_sanctions_need_an_explicit_statement():
    """해소·철회·취소·종료는 그렇다고 적힌 문장이 있을 때만 인정한다. 삭제만으로는 아니다."""
    for kind in TABLE["kinds"]:
        if kind["front"] or kind["code"] == "SANCTION":
            for change in kind["changes"]:
                if change["signal"] == "POSITIVE":
                    assert change.get("explicitOnly") is True, (kind["code"], change["code"])


def test_capital_reduction_is_split_by_its_type():
    kind = next(k for k in TABLE["kinds"] if k["code"] == "CAPITAL_REDUCTION")
    signal = {c["code"]: c["signal"] for c in kind["changes"]}
    assert signal == {"FREE_FOR_DEFICIT": "CAUTION", "PAID": "MIXED", "WITHDRAWN": "POSITIVE"}


def test_signal_notice_says_it_is_not_an_investment_judgment():
    assert "투자 판단이 아니" in TABLE["signalNotice"]


def test_glossary_terms_are_unique_and_have_meanings():
    terms = [g["term"] for g in TABLE["glossary"]]
    assert len(set(terms)) == len(terms)
    assert all(g["meaning"] for g in TABLE["glossary"])


def test_every_answer_event_has_a_kind_and_change_from_the_table():
    """7.6 정답 사건의 종류·변화(7.8)는 기준표에 있는 값이고 근거 원문이 있다."""
    changes = {k["code"]: {c["code"] for c in k["changes"]} for k in TABLE["kinds"]}
    events = [
        e
        for path in sorted((Path(__file__).parents[1] / "fixtures" / "events").glob("2*.json"))
        for e in json.loads(path.read_text(encoding="utf-8"))["events"]
    ]
    assert len(events) == 28
    for e in events:
        assert e["signalChange"] in changes[e["signalKind"]], e["name"]
        assert e["signalEvidence"], e["name"]


def test_glossary_terms_without_a_confirmed_source_are_marked():
    for g in TABLE["glossary"]:
        assert (g["source"] is None) == (g["sourceStatus"] == "출처 확인 못함"), g["term"]
