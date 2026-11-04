"""도구마다 쓰는 크레딧(가설).

요금제 화면(FS-73)과 노션 결정 로그 '수익화: 과금 단위와 가격 원칙'과 같은 값이다.
시제품은 과금하지 않는다(charged=0). 다만 에이전트가 부르기 전에 값을 알 수 있게
도구 설명과 응답에 함께 적는다(가격 원칙 6 '기계가 읽는 가격·한도').
"""

CREDITS_PER_CALL: dict[str, int] = {
    "search_companies": 0,
    "list_reports": 0,
    "list_company_analyses": 0,
    "get_analysis_summary": 1,
    "list_text_changes": 1,
    "list_financial_changes": 1,
}

NOTE = "시제품이라 과금하지 않아요. 크레딧은 요금제 가설(1 크레딧≈100원)이에요."


def billing(tool: str) -> dict[str, object]:
    """응답에 붙이는 과금 정보.

    검증된 결과에만 과금한다는 원칙에 따라 오류 응답에는 붙이지 않는다.
    """
    return {
        "tool": tool,
        "creditsHypothesis": CREDITS_PER_CALL[tool],
        "charged": 0,
        "note": NOTE,
    }
