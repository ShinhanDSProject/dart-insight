"""OpenDART 인증키가 동작하는지 확인한다.

실행: uv run python scripts/check_dart_key.py
삼성전자(corp_code 00126380)의 최근 정기공시 목록을 1건 조회한다.
"""

import sys
from datetime import date, timedelta

import requests

from dart_insight_ai.config import get_dart_api_key

LIST_URL = "https://opendart.fss.or.kr/api/list.json"


def main() -> int:
    today = date.today()
    params = {
        "crtfc_key": get_dart_api_key(),
        "corp_code": "00126380",
        "bgn_de": (today - timedelta(days=365)).strftime("%Y%m%d"),
        "end_de": today.strftime("%Y%m%d"),
        "pblntf_ty": "A",
        "page_count": 1,
    }
    resp = requests.get(LIST_URL, params=params, timeout=30)
    resp.raise_for_status()
    body = resp.json()

    # OpenDART는 오류도 HTTP 200으로 돌려주므로 본문 status를 확인한다.
    if body.get("status") != "000":
        print(f"실패: status={body.get('status')} message={body.get('message')}")
        return 1

    report = body["list"][0]
    print("인증키 정상 동작")
    print(f"  {report['corp_name']} | {report['report_nm']} | rcept_no={report['rcept_no']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
