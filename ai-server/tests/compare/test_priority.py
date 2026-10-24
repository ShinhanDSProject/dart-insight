from app.compare.priority import (
    HIGH,
    LOW,
    MEDIUM,
    UNRANKED,
    prioritize,
    section_rule,
)
from app.compare.text_diff import (
    ADDED,
    DELETED,
    MODIFIED,
    MOVED,
    NUMERIC_UPDATE,
    REVIEW_NEEDED,
    Change,
    Position,
)

BUSINESS = "II. 사업의 내용 > 1. 사업의 개요"
FINANCE = "III. 재무에 관한 사항 > 2. 연결재무제표"


def change(kind: str, path: str, block: str = "PARAGRAPH", **kwargs) -> Change:
    previous = None if kind == ADDED else Position(1, 1)
    current = None if kind == DELETED else Position(1, 1)
    return Change(kind, block, "MATCHED", path.split(" > ")[-1], path, previous, current, **kwargs)


def test_section_rule_uses_the_strongest_section_in_the_path() -> None:
    assert section_rule(BUSINESS) == (30, "사업의 내용 섹션")
    assert section_rule("XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등")[0] == 25
    assert section_rule("VII. 주주에 관한 사항")[0] == 5


def test_new_paragraph_in_business_section_comes_first() -> None:
    priority = prioritize(change(ADDED, BUSINESS), None, "미국에 공장을 새로 짓습니다.")

    assert priority.level == HIGH
    assert priority.score == 60
    assert priority.reasons == ["사업의 내용 섹션 +30", "문장·표 추가 +20", "문단 +10"]


def test_numeric_update_table_change_goes_last() -> None:
    priority = prioritize(
        change(NUMERIC_UPDATE, FINANCE, "TABLE", numbers_only=True, similarity=0.98),
        "매출 | 1,000",
        "매출 | 1,200",
    )

    assert priority.level == LOW
    assert priority.score == 0
    assert priority.reasons == ["재무에 관한 사항 섹션 +10", "숫자만 바뀜(재무 수치 탭과 겹침) -20"]


def test_numeric_update_scores_like_numbers_only_modification_before() -> None:
    # priority-1: 섹션 30 + 수정 10 + 문단 10 - 숫자만 바뀜 30 = 20
    priority = prioritize(
        change(NUMERIC_UPDATE, BUSINESS, numbers_only=True, similarity=0.95), "1명", "2명"
    )

    assert priority.score == 20
    assert priority.level == LOW


def test_moved_paragraph_ranks_below_real_changes() -> None:
    text = "당사는 미국에 공장을 짓고 있습니다."
    moved = prioritize(change(MOVED, BUSINESS, similarity=1.0), text, text)
    added = prioritize(change(ADDED, BUSINESS), None, text)
    modified = prioritize(change(MODIFIED, BUSINESS, similarity=0.9), "a", "b")

    assert moved.level == LOW
    assert moved.score == 20
    assert "위치 이동(내용은 그대로) -20" in moved.reasons
    assert moved.score is not None and added.score is not None and modified.score is not None
    assert moved.score < modified.score < added.score


def test_keywords_already_in_moved_text_do_not_raise_priority() -> None:
    text = "소송과 합병에 관한 내용입니다."
    priority = prioritize(change(MOVED, BUSINESS, similarity=1.0), text, text)

    assert not [r for r in priority.reasons if r.startswith("핵심어")]


def test_keywords_in_new_words_raise_priority_up_to_two() -> None:
    priority = prioritize(
        change(MODIFIED, "VII. 주주에 관한 사항", similarity=0.9),
        "최대주주는 변동이 없습니다.",
        "최대주주는 변동이 없습니다. 소송과 분쟁, 제재가 있습니다.",
    )

    assert [r for r in priority.reasons if r.startswith("핵심어")] == [
        "핵심어 '소송' +15",
        "핵심어 '분쟁' +15",
    ]
    assert priority.level == MEDIUM


def test_words_already_there_do_not_count_as_keywords() -> None:
    priority = prioritize(
        change(MODIFIED, "VII. 주주에 관한 사항", similarity=0.9),
        "소송이 있습니다. 1건",
        "소송이 있습니다. 2건",
    )

    assert not [r for r in priority.reasons if r.startswith("핵심어")]


def test_big_rewrite_scores_more_than_small_edit() -> None:
    small = prioritize(change(MODIFIED, BUSINESS, similarity=0.9), "a", "b")
    big = prioritize(change(MODIFIED, BUSINESS, similarity=0.4), "a", "b")

    assert big.score is not None and small.score is not None
    assert big.score - small.score == 10


def test_review_needed_is_not_ranked() -> None:
    review = Change(
        REVIEW_NEEDED,
        "SECTION",
        "AMBIGUOUS",
        "기타",
        "기타",
        None,
        Position(1),
        review_reason="짝 없음",
    )

    priority = prioritize(review, None, None)

    assert priority.level == UNRANKED
    assert priority.score is None
