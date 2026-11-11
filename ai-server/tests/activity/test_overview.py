import copy

from app.activity import fake, overview
from app.activity.model import (
    CURRENT,
    ActivityInput,
    DisclosureFact,
    FinancialFact,
    OverviewContext,
    Source,
)
from app.activity.prompt import OVERVIEW_TASK
from app.activity.validate import check_overview
from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient

CUR = "20260814003699"
REPORT = f"{CUR}#B1161"
FIN = "F123"
DISC = "D20260319801333"
SOURCE = Source(
    REPORT,
    1,
    CURRENT,
    "III. 재무에 관한 사항",
    None,
    "ADDED",
    "하만은 2025년 9월 23일 Sound United를 인수하였습니다. 계약 기간은 2033.12.31까지입니다.",
)
ACTIVITY = ActivityInput(
    "예시전자",
    "반기보고서 (2025.06)",
    "반기보고서 (2026.06)",
    [SOURCE],
    1,
    "2025-06-30",
    "2026-08-14",
    [FinancialFact(FIN, "연결 손익계산서 매출액: 이전 153.7조원, 이번 305.4조원, 증감률 +98.7%")],
    [
        DisclosureFact(
            DISC, "2026-03-19", "기업가치제고계획(자율공시)", "시설·R&D 110조원 이상을 투자합니다."
        )
    ],
)
CONTEXT = OverviewContext(ACTIVITY, [SOURCE])
GOOD = {
    "overview": {
        "text": "매출액은 305.4조원으로 늘었어요. 시설·R&D에 110조원 이상을 투자하기로 했어요.",
        "evidenceIds": [FIN, DISC],
    },
    "timeline": [
        {"date": "2026-03-19", "text": "시설·R&D 110조원 이상 투자 계획", "evidenceIds": [DISC]},
        {"date": "2025-09-23", "text": "하만이 Sound United를 인수", "evidenceIds": [REPORT]},
    ],
}
SETTINGS = LlmSettings(provider="fake", max_retries=0, max_output_retries=2)


def with_timeline(**changes: object) -> dict:
    data = copy.deepcopy(GOOD)
    data["timeline"][0].update(changes)
    return data


def test_good_output_is_sorted_by_date() -> None:
    checked = check_overview(GOOD, CONTEXT)

    assert checked.problems == []
    assert [e.date for e in checked.result.timeline] == ["2025-09-23", "2026-03-19"]
    assert checked.result.overview is not None
    assert checked.result.overview.evidence_ids == (FIN, DISC)


def test_overview_number_not_in_cited_source_is_rejected() -> None:
    data = copy.deepcopy(GOOD)
    data["overview"]["text"] = "매출액은 2배인 310조원이 됐어요."

    checked = check_overview(data, CONTEXT)

    assert checked.result.overview is None
    assert any("overview" in p for p in checked.problems)


def test_date_outside_period_is_rejected() -> None:
    data = with_timeline(date="2033-12-31", evidenceIds=[REPORT], text="계약 만료")

    checked = check_overview(data, CONTEXT)

    assert "비교 기간 밖" in checked.problems[0]
    assert len(checked.result.timeline) == 1


def test_date_must_be_in_cited_text_or_receipt_date() -> None:
    checked = check_overview(with_timeline(date="2026-03-20"), CONTEXT)

    assert "접수일도 아닙니다" in checked.problems[0]


def test_unknown_evidence_and_bad_date_are_rejected() -> None:
    assert check_overview(with_timeline(evidenceIds=["D999"]), CONTEXT).problems
    assert check_overview(with_timeline(date="2026.03.19"), CONTEXT).problems
    assert check_overview(with_timeline(date="2026-02-30"), CONTEXT).problems


def test_investment_advice_is_rejected() -> None:
    assert check_overview(with_timeline(text="지금 매수 추천"), CONTEXT).problems


def test_report_sources_keep_cited_or_dated_only() -> None:
    plain = Source(f"{CUR}#B9", 2, CURRENT, "I", None, "ADDED", "본점을 옮겼습니다.")
    activity = ActivityInput("예시전자", "이전", "이번", [SOURCE, plain], 2)

    assert overview.report_sources(activity, []) == [SOURCE]


def test_bad_lines_are_dropped_after_retries() -> None:
    bad = with_timeline(date="2033-12-31")
    provider = FakeProvider(script=[bad, bad, bad])

    output = overview.generate(LlmClient(provider, SETTINGS, sleep=lambda _: None), ACTIVITY, [])

    assert len(output.calls) == 3
    assert [e.date for e in output.result.timeline] == ["2025-09-23"]
    assert output.result.overview is not None


def test_fake_responder_passes_validation() -> None:
    provider = FakeProvider(responders={OVERVIEW_TASK: fake.respond_overview})

    output = overview.generate(LlmClient(provider, SETTINGS, sleep=lambda _: None), ACTIVITY, [])

    assert len(output.calls) == 1
    assert [e.date for e in output.result.timeline] == ["2026-03-19"]
