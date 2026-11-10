import copy

from app.activity.model import (
    CAUTION,
    CURRENT,
    EMPTY,
    EVIDENCE_NOT_CONFIRMED,
    GENERATED,
    HOLD,
    NO_CRITERIA,
    POSITIVE,
    PREVIOUS,
    ActivityInput,
    Source,
)
from app.activity.validate import check

PREV = "20250814003156"
CUR = "20260814003699"
SOURCES = [
    Source(
        f"{CUR}#B174",
        7,
        CURRENT,
        "II. 사업의 내용 > 6. 주요계약 및 연구개발활동",
        "CONTRACT",
        "ADDED",
        "당사는 Tesla와 16,544백만 달러 규모의 파운드리 공급계약을 체결하였습니다. "
        "계약 기간은 2033년 12월 31일까지입니다.",
    ),
    Source(
        f"{PREV}#B90",
        8,
        PREVIOUS,
        "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등",
        "LITIGATION",
        "DELETED",
        "당사는 특허 침해 소송의 피고로 계류 중입니다.",
    ),
    Source(
        f"{CUR}#B91",
        8,
        CURRENT,
        "XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등",
        "LITIGATION",
        "MODIFIED",
        "당사는 특허 침해 소송에서 원고의 소 취하로 소송이 종결되었습니다.",
    ),
]
ACTIVITY = ActivityInput("예시전자", "반기보고서 (2025.06)", "반기보고서 (2026.06)", SOURCES, 2)
QUOTE = "당사는 Tesla와 16,544백만 달러 규모의 파운드리 공급계약을 체결하였습니다."
OUTLOOK_TEXT = "발주가 계약대로 이어지면 파운드리 매출을 받치는 쪽으로 작용할 수 있어요."
GOOD = {
    "overview": {
        "text": "Tesla와 16,544백만 달러 규모의 공급계약을 맺었어요.",
        "evidenceIds": [f"{CUR}#B174"],
    },
    "items": [
        {
            "area": "BUSINESS",
            "audiences": ["INVESTOR", "CAREER", "PARTNER"],
            "title": "Tesla와 파운드리 공급계약",
            "summary": "Tesla와 16,544백만 달러 규모의 파운드리 공급계약을 맺었어요.",
            "facts": [{"quote": QUOTE, "evidenceId": f"{CUR}#B174"}],
            "signalKind": "MAJOR_CONTRACT",
            "signalChange": "NEW_SUPPLY",
            "signalEvidenceId": f"{CUR}#B174",
            "impacts": [
                {
                    "kind": "OUTLOOK",
                    "tone": "GOOD",
                    "text": OUTLOOK_TEXT,
                    "premises": [{"quote": QUOTE, "evidenceId": f"{CUR}#B174"}],
                },
                {
                    "kind": "CHECK",
                    "tone": None,
                    "text": "이후 보고서의 계약 이행 금액을 확인해 보세요.",
                    "premises": [],
                },
            ],
        }
    ],
}


def with_item(**changes: object) -> dict:
    data = copy.deepcopy(GOOD)
    data["items"][0].update(changes)
    return data


def with_impact(**changes: object) -> dict:
    data = copy.deepcopy(GOOD)
    data["items"][0]["impacts"][0].update(changes)
    return data


def test_valid_output_becomes_generated_cards_with_code_signal() -> None:
    checked = check(GOOD, ACTIVITY)

    assert checked.problems == []
    assert checked.result is not None
    assert checked.result.status == GENERATED
    (item,) = checked.result.items
    assert item.signal.signal == POSITIVE
    assert item.signal.evidence_id == f"{CUR}#B174"
    assert item.change_nos == (7,)
    assert checked.result.overview is not None


def test_empty_items_is_empty_not_failure() -> None:
    checked = check({"overview": None, "items": []}, ACTIVITY)

    assert checked.result is not None
    assert checked.result.status == EMPTY
    assert checked.result.overview is None


def test_quote_not_in_source_is_rejected() -> None:
    data = with_item(
        facts=[{"quote": "Tesla와 계약을 해지하였습니다.", "evidenceId": f"{CUR}#B174"}]
    )

    checked = check(data, ACTIVITY)

    assert checked.result is None
    assert "원문에 없습니다" in checked.problems[0]


def test_unknown_evidence_id_is_rejected() -> None:
    data = with_item(facts=[{"quote": QUOTE, "evidenceId": f"{CUR}#B999"}])

    assert "주어진 원문 id가 아닙니다" in check(data, ACTIVITY).problems[0]


def test_number_not_in_quotes_is_rejected() -> None:
    data = with_item(summary="Tesla와 20,000백만 달러 규모의 계약을 맺었어요.")

    assert "없는 숫자" in check(data, ACTIVITY).problems[0]


def test_outlook_without_condition_is_rejected() -> None:
    data = with_impact(text="파운드리 매출이 늘어나는 쪽이에요.")

    assert "조건형" in check(data, ACTIVITY).problems[0]


def test_outlook_that_asserts_is_rejected() -> None:
    data = with_impact(text="발주가 이어지면 매출이 반드시 늘 것이다.")

    assert "단정" in check(data, ACTIVITY).problems[0]


def test_outlook_about_stock_price_is_rejected() -> None:
    data = with_impact(text="매출이 늘면 주가가 오를 수 있어요.")

    assert "주가" in check(data, ACTIVITY).problems[0]


def test_outlook_needs_premise() -> None:
    data = with_impact(premises=[])

    assert "premises" in check(data, ACTIVITY).problems[0]


def test_check_line_with_number_is_rejected() -> None:
    data = copy.deepcopy(GOOD)
    data["items"][0]["impacts"][1]["text"] = "2027년 보고서를 확인해 보세요."

    assert "숫자" in check(data, ACTIVITY).problems[0]


def test_investment_advice_expression_is_rejected_with_rule_id() -> None:
    data = with_item(summary="Tesla와 계약을 맺어 매수할 만해요.")

    checked = check(data, ACTIVITY)

    assert checked.result is None
    assert checked.blocked_rules


def test_signal_is_hold_when_evidence_is_not_a_card_quote() -> None:
    data = with_item(signalEvidenceId=f"{PREV}#B90")

    (item,) = check(data, ACTIVITY).result.items

    assert item.signal.signal == HOLD
    assert item.signal.hold_reason == EVIDENCE_NOT_CONFIRMED


def test_signal_is_hold_when_kind_is_not_in_table() -> None:
    data = with_item(signalKind="UNKNOWN_KIND")

    (item,) = check(data, ACTIVITY).result.items

    assert (item.signal.signal, item.signal.hold_reason) == (HOLD, NO_CRITERIA)
    assert item.signal.kind_code == "OTHER"


def test_resolved_change_needs_current_side_quote() -> None:
    previous_quote = "당사는 특허 침해 소송의 피고로 계류 중입니다."
    data = with_item(
        area="RISK",
        title="특허 소송 종결",
        summary="특허 침해 소송이 끝났어요.",
        facts=[{"quote": previous_quote, "evidenceId": f"{PREV}#B90"}],
        signalKind="AUDIT_OPINION_NOT_CLEAN",
        signalChange="RESOLVED",
        signalEvidenceId=f"{PREV}#B90",
        impacts=[
            {"kind": "CHECK", "tone": None, "text": "후속 소송이 있는지 보세요.", "premises": []}
        ],
    )

    (item,) = check(data, ACTIVITY).result.items

    assert item.signal.hold_reason == EVIDENCE_NOT_CONFIRMED


def test_caution_signal_comes_from_table() -> None:
    data = with_item(
        area="RISK",
        title="특허 소송",
        summary="특허 침해 소송의 피고였어요.",
        facts=[
            {"quote": "당사는 특허 침해 소송의 피고로 계류 중입니다.", "evidenceId": f"{PREV}#B90"}
        ],
        signalKind="LITIGATION",
        signalChange="NEW_AS_DEFENDANT",
        signalEvidenceId=f"{PREV}#B90",
        impacts=[{"kind": "CHECK", "tone": None, "text": "판결을 확인해 보세요.", "premises": []}],
    )

    (item,) = check(data, ACTIVITY).result.items

    assert item.signal.signal == CAUTION


def test_bad_area_is_rejected() -> None:
    assert "area" in check(with_item(area="MARKETING"), ACTIVITY).problems[0]


def test_missing_audience_is_rejected() -> None:
    assert "audiences" in check(with_item(audiences=[]), ACTIVITY).problems[0]


def test_valid_items_are_kept_when_another_item_fails() -> None:
    data = copy.deepcopy(GOOD)
    data["items"].append({"area": "NOPE"})

    checked = check(data, ACTIVITY)

    assert checked.result is None
    assert len(checked.valid_items) == 1
