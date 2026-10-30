# ADR-0045: ai-server의 에이전트 한 단계는 LangGraph 그래프로 만들고, 답은 작성 → 검토 → 반려 시 다시 작성하는 루프로 만든다

- 상태: 제안
- 결정한 날: 2026-10-30
- 관련: [ADR-0044](0044-agent-tools-run-in-backend.md), [ADR-0008](0008-single-llm-module.md), [ADR-0026](0026-openai-llm-provider.md), 노션 [LangGraph AI Agent 최종 기능별 아키텍처 v1.2](https://app.notion.com/p/40939c0917458118b6cafebde67a0298), 기능 기획서 초안 'AI 에이전트 채팅(AI 질문 탭 대체)', `docs/project-overview.md`(LangGraph Manager-Worker, Risk Reviewer 반려 루프)

## 맥락

- ADR-0044에서 Tool은 backend가 실행하고, ai-server는 한 번 부를 때마다 다음에 부를 Tool이나 최종 답 하나를 정하기로 했다. 대화와 진행 상태는 backend가 매 요청에 보낸다.
- 그래서 LangGraph가 흔히 맡는 일인 Tool 반복 실행과 상태 저장은 ai-server의 몫이 아니다. 한 단계가 '의도 나누기 → LLM 한 번 → 검증'으로 끝난다면 평범한 함수로 충분하다.
- 그러나 최종 답을 만드는 일은 한 번에 끝나지 않는다.
  - 근거 ID가 받은 Tool 결과에 있어야 한다.
  - 숫자는 Tool 결과에 있는 값만 써야 한다.
  - 원인 표현은 원문에도 원인 표현이 있을 때만 쓸 수 있다.
  - 가치판단·투자 권유 표현이 없어야 한다(AGENTS.md, 표현 검사 5.5).
  - 등급(STATED·RELATED·NONE)을 바꾸지 않아야 한다.
- 지금 요약·질문은 이 검사를 `validate` 함수 하나로 하고, 실패하면 문제 목록을 붙여 다시 생성한다(`LlmClient.generate`). 에이전트 답은 Tool 결과 여러 종류를 섞어 쓰므로 검사가 더 많고 단계가 나뉜다.
- 변경 원인 추적·교차 검증은 '다음에 필요한 자료 정하기 → 받은 자료로 판정 → 부족하면 자료 더 요청'으로 분기한다.
- 처음 기획(`docs/project-overview.md`)은 ai-server 안의 LangGraph가 분류·원인 설명·검증을 하고, Risk Reviewer가 반려하는 루프를 두는 구조였다. 저장소 기술 스택도 ai-server를 'FastAPI, LangChain·LangGraph'로 적는다. 지금 `ai-server/requirements.txt`에는 LangChain·LangGraph가 없다.
- LLM은 `app/llm`의 `LlmClient`로만 부른다(ADR-0008). LangChain 모델 클래스는 쓰지 않기로 했다(ADR-0008·0026).

## 결정

- **도입 범위**: ai-server에 `langgraph`를 넣는다. 버전은 구현 PR에서 `requirements.txt`에 고정한다. LangGraph는 에이전트 한 단계 안의 흐름(분기, 반려 루프)을 짜는 데 쓴다.
- **위치**: 새 모듈 `ai-server/app/agent/`에 그래프(`graph.py`), 노드, 상태 형식, 프롬프트를 둔다. 라우터는 `app/api/`에 두고 경로는 `app/api/paths.py`에 더한다.
- **그래프**

  ```
  load_context → route_intent ─┬─ OUT_OF_SCOPE ─────────────────────────────→ build_response
                               ├─ workflow_step ─┬─ 자료 더 필요 → TOOL_CALLS → build_response
                               └─ plan_next_tool ┘
                                                 └─ 자료 충분 → draft_answer → review_answer
                                                       ↑                            │
                                                       └──── 반려(사유 붙임) ───────┤
                                                                                    └─ 통과 / 반려 상한 → build_response
  ```

  - `route_intent`
    - 투자 판단 질문은 기존 `app/compliance` 규칙으로 걸러 LLM 없이 `OUT_OF_SCOPE`로 끝낸다.
    - 빠른 명령(`/요약` 등)은 LLM 없이 정해진 Tool로 보낸다.
  - `workflow_step`: 변경 원인 추적·교차 검증처럼 순서가 정해진 Workflow는 받은 Tool 결과를 보고 다음 Tool을 코드로 고른다.
  - `plan_next_tool`: 그 밖의 요청은 `LlmClient.generate`의 구조화 출력으로 다음 Tool과 인자를 받거나, 자료가 충분하다고 답을 받는다(ADR-0044).
  - `draft_answer`: 받은 Tool 결과만 구분 태그로 감싸 넣고 답 초안, 근거 ID, UI 액션을 `LlmClient`로 만든다. 숫자는 Tool 결과의 값을 그대로 쓴다.
  - `review_answer`(검토 노드): 코드 규칙으로 초안을 검사하고, 문제마다 사유를 남긴다.
    - 근거 ID가 받은 Tool 결과에 있는지
    - 숫자가 Tool 결과에 있는지(`app/llm/grounding.py`)
    - 원인 표현은 인용한 원문에도 원인 표현이 있을 때만 썼는지
    - 등급을 바꾸지 않았는지
    - 표현 검사(`app/compliance`)를 통과하는지
  - 반려되면 사유를 붙여 `draft_answer`로 돌아간다. 그래도 통과하지 못하면 답을 내보내지 않고 '검토 필요'로 끝낸다.
- **재생성 예산은 하나다**: AGENTS.md의 '최대 2회 다시 생성'은 한 단계의 답 생성 전체에 적용한다. 처음 생성 1회와 다시 생성 2회, 합쳐 3회가 상한이다.
  - 그래프 상태에 생성 횟수를 두고, `draft_answer`가 `LlmClient.generate` 안에서 형식 검사 실패로 다시 만든 횟수(`LlmResult.calls`·`LlmOutputInvalid.calls`의 생성 호출 수)도 더한다.
  - `draft_answer`는 남은 횟수만큼만 다시 생성하도록 `LlmClient.generate`에 요청 단위 상한을 넘긴다. 지금은 `LlmSettings.max_output_retries` 하나뿐이라 구현 PR에서 요청 단위 상한을 더한다.
  - 합계가 상한에 닿았는데 검토를 통과하지 못하면 '검토 필요'로 끝낸다.
  - 일시 오류 재시도(연결 실패·시간 초과)는 생성이 아니므로 이 예산에 넣지 않는다.
- **LangGraph에 맡기지 않는 것**
  - 체크포인터와 메모리를 쓰지 않는다. 그래프는 요청마다 backend가 보낸 상태로 시작해 한 단계를 끝낸다.
  - LangGraph·LangChain의 도구 실행 노드를 쓰지 않는다. Tool은 backend가 실행한다(ADR-0044).
  - `interrupt`를 쓰지 않는다. 쓰기 확인은 UI 액션으로 처리한다(ADR-0044).
  - LangChain 모델 클래스를 쓰지 않는다. 노드는 `LlmClient`만 부른다.
- **`LlmClient`와의 관계**
  - 노드 안의 한 번 호출은 `LlmClient.generate`로 한다. 형식 검사(구조화 출력)와 일시 오류 재시도는 `LlmClient`가 맡는다.
  - 내용 검사와 반려는 그래프의 `review_answer`가 맡는다. 생성 횟수는 위의 하나뿐인 예산으로 센다.
- **기록**: 노드가 부른 LLM 호출 기록(`CallRecord`)과 반려 사유를 모아 응답에 담는다. backend가 `llm_call`에 저장한다. 프롬프트 버전 상수는 `app/agent/`에 둔다.
- **테스트**: 가짜 제공자(`fake`)로 시험한다.
  - 반려 루프: 첫 초안은 숫자가 틀리고 두 번째에 통과하는 경우, 끝내 실패해 '검토 필요'로 끝나는 경우
  - 재생성 예산: 형식 검사 실패와 검토 반려가 섞여도 생성 호출이 모두 3회를 넘지 않는지
  - Workflow: Tool 결과 묶음을 입력으로 주고 다음 Tool이나 최종 답을 기대값으로 고정한다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| LangGraph 없이 함수로 만들고, 검사는 지금처럼 `validate` 하나로 하기 | 에이전트 답은 Tool 결과 종류가 많아 검사가 늘고, Workflow 분기와 반려 루프가 함수 안에 뒤섞인다. 그래프로 두면 어느 노드에서 왜 반려됐는지 기록·테스트·설명하기 쉽다. 처음 기획의 Risk Reviewer 반려 루프와도 맞다 |
| LangGraph가 대화 전체를 맡기(체크포인터로 상태 저장, 도구 노드로 Tool 실행) | ADR-0044와 부딪힌다. 도구 노드가 backend를 불러야 해서 호출 방향(ADR-0002)이 깨지고, 상태 저장은 '대화를 서버에 저장하지 않는다'는 기획서 결정과 맞지 않는다 |
| LangChain 에이전트(모델·도구·메모리 묶음)를 그대로 쓰기 | LangChain 모델을 쓰면 `LlmClient`의 재시도·호출 기록·구조화 출력 규칙을 우회한다(ADR-0008·0026). 근거 ID·숫자 검사를 끼우기 어렵다 |
| 검토 노드도 LLM으로 판정하기 | 검사 항목(근거 ID, 숫자, 원인 표현, 금지 표현)이 모두 코드로 판정할 수 있고, LLM 판정은 재현되지 않으며 비용이 든다. 코드 규칙으로 잡지 못하는 문제가 실제로 보이면 그때 더한다 |

## 결과

- 좋아지는 점
  - 답이 '작성 → 검토 → 반려 시 다시 작성'을 거쳐 나가고, 반려 사유가 기록된다.
  - 정해진 Workflow는 코드가 Tool 순서를 정해 LLM 호출이 줄고 결과가 재현된다.
  - LLM 호출, 기록, 검사 함수는 기존 요약·질문과 같은 것을 쓴다.
- 감수하는 점
  - 의존성이 하나 늘어난다.
  - 반려될 때마다 LLM 호출이 늘어 응답이 느려지고 비용이 든다(다시 생성은 형식 실패와 반려를 합쳐 최대 2회).
  - 매 단계 상태를 backend가 보내므로 요청이 커진다.
  - LangGraph의 Tool 반복과 상태 저장은 쓰지 않는다.
- 지켜야 할 것
  - 노드에서 LLM은 `LlmClient`로만 부른다.
  - 검토 노드를 거치지 않은 답을 내보내지 않는다.
  - 재생성 예산을 넘으면 '검토 필요'로 끝내고, 실패를 성공으로 처리하지 않는다. 그래프와 `LlmClient`가 각자 따로 다시 생성 횟수를 세지 않는다.
  - 그래프에 체크포인터·도구 노드·`interrupt`를 넣지 않는다. 넣어야 하면 새 ADR로 ADR-0044와 이 ADR을 대체한다.

## 다시 볼 때

- 반려가 잦아 응답 시간·비용이 목표를 넘을 때(목표는 기획서의 열린 질문)
- 코드 규칙으로 잡지 못하는 답 오류가 반복돼 검토 노드에 LLM 판정이 필요할 때
- 답을 스트리밍으로 보내야 할 때
- 대화 저장을 하기로 해서 서버 쪽 상태가 필요해질 때
