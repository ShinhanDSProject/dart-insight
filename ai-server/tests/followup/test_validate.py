import pytest

from app.followup.model import (
    CHANGED,
    GENERATED,
    MENTIONED,
    NOT_FOUND,
    FollowupInput,
    Plan,
    Source,
)
from app.followup.validate import JUDGMENT_RULE, check, judgment_words

PREV = "20250311000456"
CUR = "20260310000123"
LINE = Source(
    f"{CUR}#B310",
    "II. 사업의 내용 > 3. 원재료 및 생산설비",
    "평택 신규 라인은   증설 공사를\n진행 중이며 2026년 하반기 가동을 목표로 합니다.",
)
DELAY = Source(
    f"{CUR}#B320",
    "IV. 이사의 경영진단 및 분석의견",
    "미국 공장 착공은 시장 상황을 고려해 2027년으로 연기하였습니다.",
)
OTHER = Source(
    f"{CUR}#B900", "IV", "배당은 연 2회 지급할 예정입니다. 이 문단은 다른 계획의 후보입니다."
)
P1 = Plan(
    "P1", "INVESTMENT", "평택 라인 증설 계획을 밝혔어요.", "평택 라인을 증설할 계획입니다.", [LINE]
)
P2 = Plan(
    "P2", "INVESTMENT", "미국 공장 착공 계획을 밝혔어요.", "미국 공장을 착공할 예정입니다.", [DELAY]
)
P3 = Plan("P3", "FINANCIAL", "배당 정책을 밝혔어요.", "배당을 늘릴 계획입니다.", [OTHER])
P4 = Plan("P4", "OTHER", "후보가 없는 계획이에요.", "후보가 없는 계획입니다.", [])
FOLLOWUP = FollowupInput(
    "예시전자", "사업보고서 (2024.12)", "사업보고서 (2025.12)", [P1, P2, P3, P4]
)


def answer(plan_id: str, status: str, summary=None, quote=None, *ids: str) -> dict:
    return {
        "planId": plan_id,
        "status": status,
        "summary": summary,
        "quote": quote,
        "evidenceIds": list(ids),
    }


def nf(plan_id: str) -> dict:
    return answer(plan_id, NOT_FOUND)


def good() -> list[dict]:
    return [
        answer(
            "P1",
            MENTIONED,
            "올해 보고서에 평택 신규 라인 증설 공사를 진행 중이라고 적었어요.",
            "평택 신규 라인은 증설 공사를 진행 중이며",
            f"{CUR}#B310",
        ),
        answer(
            "P2",
            CHANGED,
            "올해 보고서에 미국 공장 착공을 2027년으로 연기했다고 적었어요.",
            "미국 공장 착공은 시장 상황을 고려해 2027년으로 연기하였습니다.",
            f"{CUR}#B320",
        ),
        nf("P3"),
        nf("P4"),
    ]


def test_grounded_followups_pass_in_plan_order_with_normalized_quote() -> None:
    data = {"followups": list(reversed(good()))}

    checked = check(data, FOLLOWUP)

    assert checked.result is not None
    assert checked.result.status == GENERATED
    assert [(f.plan_id, f.status) for f in checked.result.followups] == [
        ("P1", MENTIONED),
        ("P2", CHANGED),
        ("P3", NOT_FOUND),
        ("P4", NOT_FOUND),
    ]
    assert checked.result.followups[0].quote == "평택 신규 라인은 증설 공사를 진행 중이며"
    assert checked.result.followups[2].summary is None
    assert checked.result.followups[2].evidence_ids == []


def test_missing_and_duplicate_and_unknown_plans_fail() -> None:
    missing = check({"followups": good()[:3]}, FOLLOWUP)
    duplicate = check({"followups": [*good(), nf("P4")]}, FOLLOWUP)
    unknown = check({"followups": [*good(), nf("P9")]}, FOLLOWUP)

    assert missing.result is None and "답하지 않은 계획" in missing.problems[0]
    assert duplicate.result is None and "하나만" in duplicate.problems[0]
    assert unknown.result is None and "P9" in unknown.problems[0]


def test_mentioned_without_evidence_fails() -> None:
    data = {"followups": [{**good()[0], "evidenceIds": []}, *good()[1:]]}

    checked = check(data, FOLLOWUP)

    assert checked.result is None
    assert "근거가 없습니다" in checked.problems[0]


def test_evidence_from_another_plans_candidates_fails() -> None:
    # B900은 P3의 후보다. P1에서는 쓸 수 없다
    bad = answer(
        "P1", MENTIONED, "배당 지급 예정이라고 적었어요.", "배당은 연 2회 지급할 예정입니다."
    )
    bad["evidenceIds"] = [f"{CUR}#B900"]

    checked = check({"followups": [bad, *good()[1:]]}, FOLLOWUP)

    assert checked.result is None
    assert "그 계획의 후보 id가 아닙니다" in checked.problems[0]


def test_quote_not_in_candidate_text_fails() -> None:
    data = {
        "followups": [{**good()[0], "quote": "평택 신규 라인은 증설을 끝냈습니다."}, *good()[1:]]
    }

    checked = check(data, FOLLOWUP)

    assert checked.result is None
    assert "quote가 인용한 원문에 없습니다" in checked.problems[0]


def test_number_not_in_quote_fails() -> None:
    data = {
        "followups": [
            {**good()[0], "summary": "올해 보고서에 2026년 가동을 위해 공사 중이라고 적었어요."},
            *good()[1:],
        ]
    }

    checked = check(data, FOLLOWUP)

    assert checked.result is None
    assert "숫자" in checked.problems[0]


def test_not_found_with_quote_or_evidence_fails() -> None:
    bad = answer("P3", NOT_FOUND, None, "배당은 연 2회 지급할 예정입니다.", f"{CUR}#B900")

    checked = check({"followups": [*good()[:2], bad, nf("P4")]}, FOLLOWUP)

    assert checked.result is None
    assert "NOT_FOUND는" in checked.problems[0]


def test_plan_without_candidates_can_only_be_not_found() -> None:
    bad = answer(
        "P4", MENTIONED, "관련 내용을 적었어요.", "평택 신규 라인은 증설 공사를", f"{CUR}#B310"
    )

    checked = check({"followups": [*good()[:3], bad]}, FOLLOWUP)

    assert checked.result is None
    assert "NOT_FOUND로만" in checked.problems[0]


def test_unknown_status_fails() -> None:
    data = {"followups": [{**good()[0], "status": "KEPT"}, *good()[1:]]}

    assert check(data, FOLLOWUP).result is None


@pytest.mark.parametrize(
    "summary",
    [
        "올해 보고서를 보면 회사가 증설 약속을 지켰어요.",
        "회사가 계획을 어겼다고 볼 수 있어요.",
        "증설 계획을 이행했어요.",
        "증설 계획을 이행하지 못했어요.",
        "증설 진행 상황이 우수해요.",
        "착공 계획은 실패로 끝났어요.",
        "증설을 성공적으로 진행했어요.",
    ],
)
def test_judgment_words_in_summary_fail_with_rule(summary: str) -> None:
    data = {"followups": [{**good()[0], "summary": summary}, *good()[1:]]}

    checked = check(data, FOLLOWUP)

    assert checked.result is None
    assert "계획을 평가하는 표현" in checked.problems[0]
    assert checked.blocked_rules == [JUDGMENT_RULE]


def test_judgment_words_finds_evaluation_only() -> None:
    assert judgment_words("올해 보고서에 공사를 진행 중이라고 적었어요.") == []
    assert judgment_words("약속을 지켰고 성공적이었어요") == ["지켰", "성공적"]


def test_trade_recommendation_in_summary_fails_with_rule() -> None:
    data = {
        "followups": [{**good()[0], "summary": "증설 중이라 지금이 매수 기회예요."}, *good()[1:]]
    }

    checked = check(data, FOLLOWUP)

    assert checked.result is None
    assert checked.blocked_rules == ["TRADE_RECOMMENDATION"]


def test_not_json_object_fails() -> None:
    assert check([], FOLLOWUP).result is None
    assert check({"items": []}, FOLLOWUP).result is None
