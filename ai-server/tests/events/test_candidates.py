from dataclasses import replace

import pytest

from app.compare.listing import (
    AUDIT,
    BOARD,
    BUSINESS,
    CONTRACT,
    DIVIDEND,
    FORMATTING,
    FUNDING,
    GROUP_MOVED,
    HEADING,
    LITIGATION,
    MAIN,
    NOTE,
    OTHER,
    PAIRED_TABLE,
    SHAREHOLDER,
    UNPAIRED,
)
from app.compare.text_diff import ADDED, DELETED, MODIFIED, NUMERIC_UPDATE, REVIEW_NEEDED
from app.documents.parser import PARAGRAPH, TABLE
from app.events.candidates import CandidateChange, is_candidate

AFTER_DATE = "XI. 그 밖 > 4. 작성기준일 이후 발생한 주요사항 등 기타사항"
HISTORY = "I. 회사의 개요 > 2. 회사의 연혁"
ORDINARY = "VI. 이사회 등 회사의 기관에 관한 사항 > 1. 이사회에 관한 사항"


def _change(**overrides: object) -> CandidateChange:
    """후보 규칙에 하나도 걸리지 않는 변경에서 값을 바꾼다."""
    base = CandidateChange(MODIFIED, TABLE, MAIN, BOARD, False, ORDINARY)
    return replace(base, **overrides)


def test_ordinary_table_change_is_not_candidate() -> None:
    assert not is_candidate(_change())


def test_heading_is_candidate() -> None:
    assert is_candidate(_change(change_type=ADDED, group=HEADING, field=None))


def test_unpaired_change_is_candidate() -> None:
    assert is_candidate(_change(change_type=REVIEW_NEEDED, group=UNPAIRED, field=None))


def test_change_raised_from_note_is_candidate() -> None:
    path = "III. 재무에 관한 사항 > 3. 연결재무제표 주석"
    assert is_candidate(_change(field=OTHER, raised_from_note=True, section_path=path))


@pytest.mark.parametrize("field", [LITIGATION, CONTRACT, FUNDING, DIVIDEND, AUDIT])
def test_change_in_focus_field_is_candidate(field: str) -> None:
    assert is_candidate(_change(field=field))


@pytest.mark.parametrize("field", [BUSINESS, BOARD, SHAREHOLDER, OTHER])
def test_table_change_in_other_field_is_not_candidate(field: str) -> None:
    assert not is_candidate(_change(field=field))


@pytest.mark.parametrize("group", [MAIN, HEADING])
def test_change_after_report_date_is_candidate(group: str) -> None:
    assert is_candidate(_change(group=group, field=OTHER, section_path=AFTER_DATE))


def test_section_title_with_other_spacing_still_matches() -> None:
    path = "XI. 그 밖 > 4. 작성기준일이후 발생한 주요사항"
    assert is_candidate(_change(field=OTHER, section_path=path))
    assert is_candidate(_change(field=OTHER, section_path="I. 회사의 개요 > 2. 회사의  연혁"))


def test_change_in_company_history_is_candidate() -> None:
    assert is_candidate(_change(field=OTHER, section_path=HISTORY))


def test_added_paragraph_in_any_field_is_candidate() -> None:
    assert is_candidate(_change(change_type=ADDED, block_type=PARAGRAPH))


@pytest.mark.parametrize("change_type", [MODIFIED, NUMERIC_UPDATE, DELETED])
def test_other_paragraph_change_is_not_candidate(change_type: str) -> None:
    assert not is_candidate(_change(change_type=change_type, block_type=PARAGRAPH))


def test_added_table_is_not_candidate_by_itself() -> None:
    assert not is_candidate(_change(change_type=ADDED, block_type=TABLE))


@pytest.mark.parametrize("group", [NOTE, FORMATTING, GROUP_MOVED, PAIRED_TABLE])
def test_group_outside_input_is_not_candidate_even_in_named_section(group: str) -> None:
    assert not is_candidate(_change(group=group, field=None, section_path=AFTER_DATE))
    assert not is_candidate(_change(group=group, field=None, section_path=HISTORY))
