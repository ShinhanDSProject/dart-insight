from app.llm.grounding import number_problem, numbers


def test_numbers_are_compared_without_commas() -> None:
    assert numbers("매출 1,234억 원과 12.5%") == {"1234", "12.5"}


def test_numbers_only_from_cited_sources_are_allowed() -> None:
    sources = {"A": "매출액은 1,234억 원이에요.", "B": "직원은 50명이에요."}

    assert number_problem("매출액은 1234억 원이에요.", sources, ["A"]) is None
    assert number_problem("직원은 50명이에요.", sources, ["A"]) is not None


def test_magnitude_words_must_be_in_the_cited_source() -> None:
    sources = {"A": "매출액이 늘었어요."}

    problem = number_problem("매출액이 두 배로 늘었어요.", sources, ["A"])

    assert problem is not None and "크기 표현" in problem
