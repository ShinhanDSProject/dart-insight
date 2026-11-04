# DART Insight MCP 서버 (읽기 전용 시제품)

사용자의 AI 에이전트(Claude, ChatGPT 등 MCP를 지원하는 앱)가 DART Insight의 **검증된 공시 비교 결과**를 도구로 가져가게 하는 서버입니다. 화면과 같은 backend 공개 API(`/api/...`)만 부르고, 쓰기는 하지 않습니다([ADR-0052](../docs/adr/0052-mcp-server-read-only.md)).

## 도구

| 도구 | 하는 일 | 크레딧(가설) |
| --- | --- | --- |
| `search_companies` | 회사명·종목코드·초성으로 기업 찾기 | 0 |
| `list_reports` | 기업의 정기보고서 목록 | 0 |
| `list_company_analyses` | 이 기업에서 이미 끝난 비교 분석 목록 | 0 |
| `get_analysis_summary` | 근거 기반 요약(코드 사실 문장 + 'AI 생성' 문장 + 근거 위치) | 1 |
| `list_text_changes` | 바뀐 문장·표(우선순위 순, 위험 관련만·유형 거르기, `page`로 이어 읽기) | 1 |
| `get_text_change` | 문장·표 변경 하나의 이전·현재 원문과 근거 위치(인용할 때) | 0 |
| `list_financial_changes` | 계정별 이전·현재 금액과 코드가 계산한 증감 | 1 |

- 응답은 `{ "data": …, "billing": { "creditsHypothesis", "charged": 0, … }, "notice": … }`입니다. 시제품은 과금하지 않고, 크레딧은 요금제 가설(1 크레딧 ≈ 100원)을 미리 보여 주기만 합니다.
- backend가 오류를 돌려주면 과금 없이 `코드 (상태): 메시지 · traceId=…` 도구 오류로 알려 줍니다. backend에 연결하지 못하면 코드는 `MCP_BACKEND_UNREACHABLE`(상태 0)입니다.
- 분석 요청·노트 같은 쓰기 도구는 크레딧 장부·API 키가 생긴 뒤에 엽니다.

## 실행

Python 3.12, backend가 떠 있어야 합니다(기본 `http://localhost:8090`).

```bash
cd mcp-server
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
DART_INSIGHT_API_URL=http://localhost:8090 python -m dart_insight_mcp.server
```

### Claude Code에 붙이기

```bash
claude mcp add dart-insight \
  --env DART_INSIGHT_API_URL=http://localhost:8090 --env PYTHONPATH=/절대경로/mcp-server \
  -- /절대경로/mcp-server/.venv/bin/python -m dart_insight_mcp.server
```

### Claude Desktop 등 MCP 앱에 붙이기

설정 파일의 `mcpServers`에 넣습니다. 앱이 어느 폴더에서 실행하든 패키지를 찾도록 `PYTHONPATH`를 `mcp-server/` 절대 경로로 둡니다.

```json
{
  "mcpServers": {
    "dart-insight": {
      "command": "/절대경로/mcp-server/.venv/bin/python",
      "args": ["-m", "dart_insight_mcp.server"],
      "env": { "DART_INSIGHT_API_URL": "http://localhost:8090", "PYTHONPATH": "/절대경로/mcp-server" }
    }
  }
}
```

## 검사

```bash
pip install -r requirements-dev.txt
ruff check .
pytest
```

## 지키는 것

- backend 공개 API만 부릅니다. 경로 문자열은 `dart_insight_mcp/paths.py`에만 둡니다.
- 숫자는 backend가 계산한 값 그대로 넘깁니다. 응답마다 출처(DART)와 '투자 조언이 아님' 안내를 붙입니다.
- 키·비밀값은 쓰지 않습니다(공개 API만 읽음).
