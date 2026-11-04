"""이 서버가 부르는 backend 공개 API 경로.

경로 문자열은 여기에만 둔다(AGENTS.md 'API·데이터 규칙').
"""

from urllib.parse import quote


def _seg(value: str | int) -> str:
    return quote(str(value), safe="")


COMPANIES = "/api/companies"


def company_reports(corp_code: str) -> str:
    return f"/api/companies/{_seg(corp_code)}/reports"


def company_analyses(corp_code: str) -> str:
    return f"/api/companies/{_seg(corp_code)}/analyses"


def analysis_summary(analysis_id: int) -> str:
    return f"/api/analyses/{_seg(analysis_id)}/summary"


def text_changes(analysis_id: int) -> str:
    return f"/api/analyses/{_seg(analysis_id)}/text-changes"


def financial_changes(analysis_id: int) -> str:
    return f"/api/analyses/{_seg(analysis_id)}/financial-changes"
