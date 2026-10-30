# ADR-0044: 에이전트 채팅의 Tool은 backend가 실행하고, ai-server는 다음에 부를 Tool과 최종 답만 정한다

- 상태: 제안
- 결정한 날: 2026-10-30
- 관련: 노션 [LangGraph AI Agent 최종 기능별 아키텍처 v1.2](https://app.notion.com/p/40939c0917458118b6cafebde67a0298), 기능 기획서 초안 'AI 에이전트 채팅(AI 질문 탭 대체)', ADR-0002·0008·0023·0029

## 맥락

- 에이전트 채팅은 자연어 요청을 기존 기능(문장 변경 검색, 재무 변화, 원문, 요약, 관련 수시공시, 기업 정보, 분석 요청, 노트·관심 기업 등 Tool 약 25개)으로 바꿔 실행하고, 답과 근거, 화면 이동(UI 액션)을 돌려준다.
- Tool이 쓰는 자료와 기능은 모두 backend에 있다. MariaDB에 연결하는 것은 backend뿐이고, 호출 방향은 React → Spring Boot → FastAPI 하나뿐이다. FastAPI는 backend를 부르지 않는다([ADR-0002](0002-monorepo-and-call-direction.md)).
- LLM은 ai-server의 한 모듈로만 부른다([ADR-0008](0008-single-llm-module.md)). `app/llm/client.py`의 `LlmClient`는 JSON 결과를 받아 `validate`로 검사하고 실패하면 다시 생성하는 `generate`를 제공한다. 제공자는 OpenAI Responses API이고, 요청에 `output_schema`가 있으면 엄격 구조화 출력(json_schema, `strict: true`)으로 받는다([ADR-0026](0026-openai-llm-provider.md)). 제공자의 Tool 호출(function calling) 기능은 쓰지 않는다.
- 근거 질문은 이미 backend가 후보 문단·계정 사실을 만들고 ai-server `/internal/answers`가 검증·재생성하는 경로가 있다([ADR-0023](0023-grounded-question-answering.md), [ADR-0029](0029-company-question-answering.md)). 채팅은 이 경로를 다시 써야 한다.
- 기획서 초안에서 정한 것: 대화는 서버에 저장하지 않는다(화면이 최근 몇 턴과 화면 맥락을 보낸다). 노트·관심 기업 같은 쓰기는 사용자가 확인한 뒤에만 실행한다. 게시·삭제는 에이전트가 실행하지 않는다.
- 아키텍처 문서 v1.1은 'Agent가 Spring 내부 API를 호출'한다고 적어 ADR-0002와 부딪혔다. v1.2에서 이 부분을 이 ADR로 정하기로 했다.

## 결정

- **실행 주체**: Tool은 backend가 실행한다. ai-server(LangGraph)는 한 번 부를 때마다 '다음에 부를 Tool과 인자' 또는 '최종 답' 하나를 정해 돌려준다. ADR-0002의 호출 방향은 그대로다.
- **왕복 흐름**
  1. React가 `POST /api/agent/chat`에 질문, 최근 몇 턴, 화면 맥락(기업, 분석 ID, 탭, 고른 변경)을 보낸다.
  2. backend가 허용 Tool 목록(이름·설명·인자 형식)과 지금까지의 Tool 결과를 붙여 ai-server 내부 API를 부른다.
  3. ai-server는 `TOOL_CALLS`(부를 Tool과 인자), `FINAL`(답, 근거 ID, UI 액션), `OUT_OF_SCOPE` 중 하나를 돌려준다.
  4. `TOOL_CALLS`면 backend가 Tool을 실행하고 결과를 붙여 2로 돌아간다. `FINAL`이나 `OUT_OF_SCOPE`면 응답한다.
- **Tool 등록**: backend의 새 도메인 패키지 `com.dartinsight.agent`에 Tool 목록을 한 곳에 둔다. Tool마다 이름, 인자 형식, 읽기·쓰기 구분, 실행할 기존 서비스 메서드를 적는다. ai-server는 Tool 목록을 코드에 따로 두지 않고 요청으로 받는다.
- **실행 규칙(backend)**
  - 목록에 없는 Tool이나 형식이 맞지 않는 인자는 실행하지 않고, 그 사실을 Tool 결과로 돌려준다.
  - Tool은 기존 서비스 메서드를 부르고, 자기 HTTP API나 채팅 API를 다시 부르지 않는다. 권한은 지금 사용자로 기존 서비스와 같게 검사한다.
  - 쓰기 Tool(노트, 메모, 관심 기업)은 왕복 안에서 실행하지 않는다. 확인 버튼 UI 액션으로 돌려주고, 사용자가 누르면 React가 기존 API(`POST /api/notes` 등)를 부른다.
  - 근거 질문 Tool은 기존 질문 서비스를 그대로 부른다. 답은 지금처럼 `analysis_question`·`company_question`에 저장된다.
  - 채팅 한 번의 왕복 횟수와 전체 시간에 상한을 두고, 넘으면 검증하지 않은 부분 결과를 내보내지 않고 끝낸다. 값은 설정으로 두고 구현 PR에서 정한다.
- **최종 답 검증**
  - ai-server는 `FINAL`의 근거 ID가 받은 Tool 결과에 있는지, 답의 숫자가 Tool 결과에 있는지(`app/llm/grounding.py`)를 확인한다. 표현 검사(`app/compliance`)도 거친다. 실패하면 `LlmClient.generate`의 재생성 규칙을 따른다.
  - backend는 응답 전에 근거 ID가 실제 저장된 원문 위치인지 한 번 더 확인하고, 아니면 그 근거를 뺀다.
- **LLM 호출 방식**: Tool 선택도 `LlmClient.generate`의 구조화 출력으로 받는다. Tool 이름은 받은 목록의 enum으로, 인자는 Tool별 형식으로 스키마에 둔다. 제공자의 Tool 호출 기능에 기대지 않는다.
- **상태**: ai-server는 대화나 그래프 상태를 저장하지 않는다. 매 요청에 필요한 상태(최근 턴, 화면 맥락, 지금까지의 Tool 결과)를 backend가 보낸다.
- **기록**
  - ai-server는 단계마다 LLM 호출 기록을 돌려주고, backend가 `llm_call`에 저장한다. task 값은 구현 PR에서 `docs/erd.md`에 더한다.
  - 한 채팅의 모든 왕복은 같은 `X-Trace-Id`를 쓴다.
- **보내지 않는 것**: Tool 결과는 공시 원문처럼 구분 태그로 감싸 자료로만 쓴다. 사용자 정보(이메일, 닉네임, 노트·메모 내용)는 ai-server에 보내지 않는다. 쓰기 Tool은 실행하지 않으므로 그 결과도 보내지 않는다.
- 경로와 요청·응답 필드는 구현 전에 `docs/api-spec.md`에 먼저 적는다. ai-server에 LangGraph를 넣는 결정은 별도 ADR로 남긴다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| ai-server가 backend 내부 API를 직접 불러 Tool을 실행(ADR-0002 대체) | 서비스가 서로를 부르게 된다. 사용자 권한을 ai-server로 넘기는 서비스 인증과 권한 전달을 새로 만들어야 하고, 권한 검사가 두 곳으로 나뉜다. 쓰기 Tool의 사용자 확인도 ai-server가 지켜야 한다 |
| 화면(React)이 Tool을 실행(LLM이 고른 Tool을 브라우저가 기존 API로 부름) | 왕복이 사용자 네트워크를 몇 번씩 거쳐 느려진다. 상한과 기록이 브라우저에 있어 조작될 수 있고, 근거 검증과 `llm_call` 저장 위치가 흩어진다 |
| 에이전트 전체를 backend(Java)에 두고 LLM도 backend에서 부름 | LLM 호출을 ai-server 한 모듈에 모은 ADR-0008과 부딪힌다. 모델 교체, 호출 기록, 표현 검사, 근거 검증을 두 언어로 다시 만들어야 한다 |
| 제공자의 Tool 호출(function calling) 기능으로 Tool 선택 | `LlmClient`·`OpenAIProvider`가 이 기능을 쓰지 않는다. 지금 쓰는 엄격 구조화 출력과 `validate`·재생성으로 Tool 이름·인자 검사를 할 수 있고, 호출 기록·재시도 규칙(ADR-0008·0026)을 그대로 쓴다. 제공자를 바꿀 때 Tool 호출 형식에 묶이지 않는다 |

## 결과

- 좋아지는 점
  - ADR-0002를 바꾸지 않는다.
  - 권한 검사, 쓰기 확인, 상한이 backend 한 곳에 있다.
  - 근거 질문, 저장된 요약 같은 기존 경로와 검증을 그대로 쓴다.
  - ai-server가 상태를 갖지 않아 다시 띄워도 진행 중인 대화를 잃지 않는다.
- 감수하는 점
  - Tool을 부를 때마다 backend↔ai-server 왕복과 LLM 호출이 한 번씩 늘어 응답이 느려진다.
  - Tool 결과를 매 왕복에 다시 보내므로 결과를 줄여 보내야 한다.
  - 왕복 제어 코드가 backend에 생긴다.
- 지켜야 할 것
  - Tool 목록은 backend 한 곳에만 둔다.
  - 쓰기·게시·삭제를 왕복 안에서 실행하지 않는다.
  - 새 Tool은 기존 서비스 메서드를 부르고 권한 검사를 그대로 거친다.
  - 왕복과 시간 상한을 끄지 않는다.

## 다시 볼 때

- 왕복 때문에 응답 시간이 목표를 넘을 때(목표는 기획서의 열린 질문)
- 제공자의 Tool 호출 기능을 쓰는 편이 구조화 출력보다 정확도·비용 면에서 나을 때
- 답을 스트리밍으로 보내야 할 때
- ai-server가 backend 자료를 직접 읽어야만 하는 Tool이 생길 때
