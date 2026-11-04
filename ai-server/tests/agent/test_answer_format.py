from app.agent.answer_format import (
    MAX_BRIEF,
    MAX_CHAT,
    answer_format,
    max_answer,
    requested_lines,
)
from app.agent.model import FORMAT_BRIEF, FORMAT_CHAT


def test_brief_requests_are_recognized_from_the_message() -> None:
    for message in [
        "3줄 요약해줘",
        "삼 줄 말고 5 줄로 정리해 주세요",
        "IR용 정리 부탁해",
        "확인할 점 알려줘",
        "요점만 정리",
        "재무 변화 항목별로 보여줘",
    ]:
        assert answer_format(message) == FORMAT_BRIEF, message


def test_ordinary_questions_stay_chat() -> None:
    ordinary = ["요약해줘", "영업이익 얼마나 바뀌었어?", "소송 관련 변경 보여줘", "줄어든 이유는?"]
    for message in ordinary:
        assert answer_format(message) == FORMAT_CHAT, message


def test_requested_lines_is_none_when_counts_disagree() -> None:
    assert requested_lines("3줄 요약해줘") == 3
    assert requested_lines("요약 5 줄로") == 5
    # '3줄 말고 5줄로'처럼 줄 수가 둘이면 어느 쪽인지 정하지 않는다
    assert requested_lines("3줄 말고 5줄로 정리해줘") is None
    assert requested_lines("정리해줘") is None


def test_max_answer_follows_format() -> None:
    assert max_answer(FORMAT_CHAT) == MAX_CHAT == 400
    assert max_answer(FORMAT_BRIEF) == MAX_BRIEF == 1500
