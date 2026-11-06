from app.compare.listing import LITIGATION, MAIN
from app.compare.text_diff import MODIFIED
from app.documents.parser import PARAGRAPH
from app.events.candidates import CandidateChange
from app.events.meaning_prompt import event_blocks
from app.events.model import (
    CAUTION,
    CURRENT,
    EVIDENCE_NOT_CONFIRMED,
    HOLD,
    MIXED_LITIGATION,
    MIXED_SIDES,
    NO_CRITERIA,
    POSITIVE,
    EventChange,
    EventInput,
    EventSignal,
    Quote,
    TextEvent,
)
from app.events.signal_reason_prompt import (
    PROMPT_VERSION,
    REASONS,
    SIDES_OF_HOLD,
    SYSTEM,
    TASK,
    WHY_HOLD_ONLY,
    build_request,
    mode_of,
)
from app.llm.prompting import SOURCE_RULE

CURRENT_RCEPT = "20260814003699"


def data() -> EventInput:
    change = EventChange(
        12,
        CandidateChange(MODIFIED, PARAGRAPH, MAIN, LITIGATION, False, "XI"),
        2028,
        1576,
        "이전 글",
        "이번 글",
    )
    return EventInput("20250814003156", CURRENT_RCEPT, [change])


def event(kind: str, change: str, name: str, signal: str, hold: str | None = None) -> TextEvent:
    return TextEvent(
        "제목",
        "종류",
        [12],
        [Quote(12, "CHANGE", CURRENT, "이번 글", f"{CURRENT_RCEPT}#B1576")],
        signal=EventSignal(kind, change, name, signal, hold),
    )


def request_of(e: TextEvent):  # noqa: ANN201
    return build_request(e, event_blocks(e, data()), {"changedRows": "2건"})


def test_mode_follows_the_signal_and_hold_reason() -> None:
    assert mode_of(event("SANCTION", "OCCURRED", "새로 발생", CAUTION)) == REASONS
    assert mode_of(event("DIVIDEND", "INCREASED", "확대", POSITIVE)) == REASONS
    assert mode_of(event("TREASURY_STOCK", "ACQUIRED", "취득", HOLD, MIXED_SIDES)) == SIDES_OF_HOLD
    assert mode_of(event("LITIGATION", "LOST", "패소", HOLD, MIXED_LITIGATION)) == WHY_HOLD_ONLY


def test_hold_without_criteria_or_evidence_has_no_reason_to_write() -> None:
    assert mode_of(event("OTHER", "OTHER", "그 밖의 변화", HOLD, NO_CRITERIA)) is None
    assert mode_of(event("SANCTION", "OCCURRED", "새로 발생", HOLD, EVIDENCE_NOT_CONFIRMED)) is None


def test_request_has_task_version_and_limits() -> None:
    request = request_of(event("SANCTION", "OCCURRED", "새로 발생", CAUTION))

    assert request.task == TASK == "event_signal_reason"
    assert request.prompt_version == PROMPT_VERSION == "event-signal-reason-1"
    assert request.max_output_tokens == 4000
    assert request.timeout_seconds == 60.0
    assert request.total_timeout_seconds == 120.0
    assert SOURCE_RULE in request.system


def test_signal_and_what_to_write_are_given_as_attributes() -> None:
    user = request_of(event("SANCTION", "OCCURRED", "새로 발생", CAUTION)).user

    assert 'signal="주의"' in user
    assert 'write="REASON"' in user
    assert 'change="새로 발생"' in user
    assert f'<disclosure id="{CURRENT_RCEPT}#B1576"' in user
    assert 'changedRows="2건"' in user


def test_mixed_sides_get_the_general_sides_of_the_table_as_reference() -> None:
    user = request_of(event("TREASURY_STOCK", "ACQUIRED", "취득", HOLD, MIXED_SIDES)).user

    assert 'write="GOOD,BAD"' in user
    assert "<generalSides" in user
    assert "지분 비율이 높아질 수 있어요" in user


def test_mixed_litigation_asks_only_why_it_was_not_judged() -> None:
    user = request_of(event("LITIGATION", "LOST", "패소", HOLD, MIXED_LITIGATION)).user

    assert 'write="WHY_HOLD"' in user
    assert "<generalSides" not in user


def test_system_prompt_has_the_rules_of_each_mode_and_forbids_advice() -> None:
    for word in ("REASON", "GOOD", "BAD", "WHY_HOLD", "2~3", "매수", "목표주가", "계산"):
        assert word in SYSTEM
    for word in ("저평가", "호재"):
        assert word in SYSTEM


def test_output_schema_has_items_with_type_text_and_evidence() -> None:
    schema = request_of(event("SANCTION", "OCCURRED", "새로 발생", CAUTION)).output_schema
    item = schema["properties"]["items"]["items"]

    assert set(item["required"]) == {"type", "text", "evidenceIds"}
    assert item["properties"]["type"]["enum"] == ["REASON", "GOOD", "BAD", "WHY_HOLD"]
