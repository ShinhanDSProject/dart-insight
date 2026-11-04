# ADR-0052: 외부 AI 에이전트용 MCP 서버를 backend 공개 API의 읽기 전용 클라이언트로 둔다

- 상태: 채택
- 결정한 날: 2026-11-04
- 관련: 이슈 3.36 MCP 시제품, 노션 [수익화 전략(BM)과 에이전트 시대 가격 정책](https://app.notion.com/p/40eb6afffc6f815481fcc7a0bbc2d23f), 결정 로그 '수익화: 첫 고객·판로'·'수익화: 과금 단위와 가격 원칙', [ADR-0002](0002-monorepo-and-call-direction.md), [ADR-0044](0044-agent-tools-run-in-backend.md)

## 맥락

- 수익화 전략은 사람뿐 아니라 사용자의 AI 에이전트(Claude·ChatGPT 등)가 우리 비교 결과를 가져가는 것을 첫 판로로 정했다. 에이전트는 MCP(Model Context Protocol)로 외부 도구를 부른다.
- 호출 방향은 React → Spring Boot → FastAPI이고(ADR-0002), 화면도 backend 공개 API만 쓴다. 에이전트 채팅의 Tool은 backend가 실행한다(ADR-0044).
- 아직 과금(크레딧 장부)·API 키가 없어서, 쓰기(분석 요청 같은 계산 비용이 드는 일)를 외부에 열면 비용을 통제할 수 없다.
- Python MCP SDK는 2.x에서 `FastMCP`가 `MCPServer`(`mcp.server.mcpserver`)로 바뀌었다(2.3.0으로 확인).

## 결정

- 새 폴더 `mcp-server/`에 MCP 서버를 둔다. 이 서버는 화면과 같은 위치의 **backend 공개 API(`/api/...`) 클라이언트**이고, ai-server나 OpenDART, DB를 직접 부르지 않는다.
- 시제품은 **읽기 전용** 도구 7개만 연다: 기업 찾기, 정기보고서 목록, 끝난 분석 목록, 요약, 문장 변화 목록, 문장 변경 상세(근거 위치), 재무 수치 변화(`mcp-server/dart_insight_mcp/server.py`). 분석 요청·노트·관심 기업 같은 쓰기는 과금과 API 키가 생긴 뒤에 연다.
- 도구 설명과 응답에 크레딧 가설과 `charged: 0`을 적는다(가격 원칙 '기계가 읽는 가격·한도', `billing.py`). backend 오류는 과금 없이 코드·추적 ID와 함께 도구 오류로 돌려준다.
- 응답마다 출처(DART)와 '투자 조언이 아님' 안내를 붙이고, 도구 안내(instructions)에 숫자를 다시 계산하지 말고 근거 위치를 함께 인용하라고 적는다.
- 전송은 우선 stdio(사용자 컴퓨터에서 실행)이고, backend 주소는 환경변수 `DART_INSIGHT_API_URL`로 정한다. 경로 문자열은 `paths.py`에만 둔다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| backend(Spring Boot) 안에 MCP 엔드포인트 | 인증·과금 없이 원격으로 열면 누구나 부를 수 있다. Java MCP 라이브러리를 새로 들이면 바꾸기 어렵다. 시제품 단계에서 backend를 키울 이유가 없다 |
| ai-server 안에 MCP | ai-server는 backend가 부르는 내부 서버라 호출 방향(ADR-0002)이 거꾸로 된다 |
| 에이전트가 OpenDART를 직접 읽게 둠 | 섹션·표 짝짓기, 코드 계산, 근거 ID 검증 같은 우리 가치가 빠진다 |
| 쓰기 도구까지 바로 열기 | 계산 비용(LLM)이 생기는 일을 과금·한도 없이 외부에 열게 된다 |

## 결과

- 좋아지는 점: 에이전트가 사람과 같은 API·같은 검증 결과를 쓴다. 과금이 생기면 같은 도구에 키·크레딧만 더하면 된다. backend·ai-server는 바뀌지 않는다.
- 감수하는 점: 원격(호스팅) MCP는 아직 없다. 사용자가 자기 컴퓨터에서 실행해야 한다. 이미 끝난 분석만 읽을 수 있다.
- 지켜야 할 것: MCP 서버는 backend 공개 API만 부른다. 쓰기 도구를 열 때는 과금·키별 한도 ADR을 먼저 쓴다. 크레딧 값은 요금제 화면(`frontend/src/features/pricing/model/pricing.ts`)과 함께 고친다.

## 다시 볼 때

- 결정 로그 '수익화: 가격 숫자 확정 방법'이 정해지거나 크레딧 장부·API 키를 만들 때(원격 streamable-http 전송, 쓰기 도구)
- MCP SDK가 다시 크게 바뀔 때(지금은 `mcp==2.3.0`)
