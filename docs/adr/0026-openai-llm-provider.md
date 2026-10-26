# ADR-0026: 실제 LLM 제공자로 OpenAI Responses API를 연결하고, 기본 모델은 gpt-6.1-sol로 둔다

- 상태: 채택
- 결정한 날: 2026-10-26
- 관련: [이슈 #50](https://github.com/ShinhanDSProject/dart-insight/issues/50)(0.7), 노션 결정 로그 [LLM 제공자·모델 선택](https://app.notion.com/p/400b6afffc6f8192bbd7e98fb597c38b), [ADR-0008](0008-single-llm-module.md), [ADR-0015](0015-explanation-grade-and-quote-check.md), [ADR-0023](0023-grounded-question-answering.md)

## 맥락

- [ADR-0008](0008-single-llm-module.md)은 제공자를 정하기 전까지 가짜 제공자(`fake`)만 두었습니다. 요약 판정·질문 답변의 품질은 실제 모델로만 볼 수 있습니다.
- 팀은 OpenAI의 Codex 모델로 돌리기로 했습니다(결정 로그 'LLM 제공자·모델 선택').
- 2026-10-26에 OpenAI 공식 문서에서 확인한 사실:
  - 모델 목록([전체 모델](https://developers.openai.com/api/docs/models/all))에서 이름에 `codex`가 붙은 모델은 `gpt-5.3-codex`만 '지원 중단 예정(Deprecated)'이고 나머지(`gpt-5.2-codex`, `gpt-5.1-codex` 등)는 이미 종료됐습니다.
  - Codex 모델 안내([Codex models](https://learn.chatgpt.com/docs/models))는 복잡한 코딩·에이전트 작업에 `gpt-6.1-sol`을 권하고, 예시 설정도 `model = "gpt-6.1-sol"`입니다.
  - [`gpt-6.1-sol` 모델 페이지](https://developers.openai.com/api/docs/models/gpt-6.1-sol): Responses API 지원, 구조화 출력(Structured outputs) 지원, `reasoning.effort`는 `low`·`medium`(기본)·`high`·`xhigh`·`max`, 최대 출력 128,000 토큰.
  - [구조화 출력 안내](https://developers.openai.com/api/docs/guides/structured-outputs): `text.format`에 `type: "json_schema"`와 `strict: true`를 주면 스키마대로 답합니다. 엄격 모드에서는 모든 속성을 `required`에 넣고 `additionalProperties: false`를 둬야 하며, 선택 값은 `null`을 허용하는 형식으로 나타냅니다. 거절은 `refusal` 내용으로, 잘린 응답은 `status: "incomplete"`와 `incomplete_details.reason`으로 옵니다.
  - [openai-python](https://github.com/openai/openai-python): Responses API가 기본 API이고, SDK는 일부 오류를 기본 2회 다시 시도하며 `max_retries=0`으로 끌 수 있습니다. 시간 초과는 `APITimeoutError`입니다.

## 결정

- 실제 제공자로 OpenAI를 연결합니다. `LLM_PROVIDER=openai`이면 `app/llm/providers.py`의 `OpenAIProvider`를 씁니다. `fake`는 테스트·키 없는 개발용으로 남깁니다.
- 기본 모델은 `gpt-6.1-sol`(`OPENAI_DEFAULT_MODEL`)입니다. 이름에 `codex`가 붙은 모델은 모두 중단 예정이거나 종료돼서, Codex가 권하는 모델 중 API로 쓸 수 있고 구조화 출력을 지원하는 이 모델을 고릅니다. `LLM_MODEL`로 바꿀 수 있습니다.
- 공식 SDK `openai`(`ai-server/requirements.txt`에 버전 고정)를 쓰고, `providers.py`에서만 import합니다([ADR-0008](0008-single-llm-module.md)).
- Responses API(`responses.create`)로 부릅니다. 시스템 프롬프트는 `instructions`, 사용자 프롬프트는 `input`의 user 메시지, 출력 상한은 `max_output_tokens`(요청의 `max_output_tokens`)로 넣고 `store: false`로 응답을 저장하지 않게 합니다.
- 요청에 `output_schema`가 있으면 엄격 구조화 출력(`text.format` json_schema, `strict: true`)으로 받습니다. 엄격 모드 제약은 `strict_schema`가 사본에 맞춥니다(모든 속성을 required로, 원래 선택이던 속성은 null 허용, `additionalProperties: false`, type 없는 enum에 type 추가). 기능 모듈의 스키마는 고치지 않습니다.
- 재시도는 `LlmClient`가 맡습니다. SDK 재시도는 끄고(`max_retries=0`), 한 번 호출의 시간 제한은 `LlmClient`가 넘긴 값을 `with_options(timeout=...)`로 줍니다.
- 오류는 이렇게 나눕니다. 연결 실패·시간 초과·429·409·408·5xx는 일시 오류(`ProviderTransientError`), 인증(401)·권한(403)·잘못된 요청(400)·없음(404)·422는 다시 시도하지 않는 오류(`ProviderError`)입니다. 모델의 거절(refusal)과 끝나지 않은 응답(출력 한도·콘텐츠 필터)도 `ProviderError`로 끝냅니다.
- 추론 강도는 `LLM_REASONING_EFFORT`로 정합니다. 비우면 보내지 않아 모델 기본값을 씁니다.
- 키는 `LLM_API_KEY`에서만 읽고, 없으면 서버를 띄울 때가 아니라 부를 때 실패합니다(`LlmUnavailable`).
- 비용: `gpt-6.1-sol`은 100만 토큰당 입력 2달러, 출력 10달러입니다([모델 페이지](https://developers.openai.com/api/docs/models/gpt-6.1-sol), 2026-10-26 기준). 가격은 바뀔 수 있으니 공식 페이지에서 확인합니다. 토큰 수는 `CallRecord`에 남습니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| `gpt-5.3-codex` | 이름에 `codex`가 붙은 마지막 모델이지만 공식 목록에서 지원 중단 예정(Deprecated)입니다. |
| Chat Completions API | `gpt-6.1-sol`은 지원하지만, SDK와 모델 안내가 Responses API를 기본으로 두고 Codex 계열 모델(`gpt-5.3-codex`)은 Responses API만 지원했습니다. 모델을 바꿔도 같은 호출을 쓰려고 Responses API를 고릅니다. |
| SDK 재시도를 그대로 두기 | `LlmClient`의 재시도·전체 시간 제한과 겹쳐 실제 시도 횟수와 호출 기록이 맞지 않습니다. |
| LangChain `ChatOpenAI` | 재시도·호출 기록은 어차피 `LlmClient`가 맡고, 얻는 것보다 의존성이 커집니다. |
| 기능 모듈 스키마를 엄격 모드에 맞게 고치기 | 다른 제공자로 바꿀 때 기능 모듈을 다시 고쳐야 합니다. 제공자 제약은 제공자 연결에서 맞춥니다. |

## 결과

- 좋아지는 점: 키만 넣으면 실제 모델로 요약·질문 답변을 돌려 품질을 평가할 수 있습니다(7.3). 스키마를 지키는 답을 받아 형식 오류로 다시 생성하는 일이 줄어듭니다.
- 감수하는 점: 원래 선택이던 속성도 null로 꼭 채워 오므로, 검증 함수는 null을 '없음'으로 읽어야 합니다(지금 스키마의 선택 속성은 이미 null을 허용합니다). 엄격 모드가 지원하지 않는 키워드(`allOf`·`not`·`if` 등)는 스키마에 쓸 수 없습니다. 실패한 분석의 호출 기록이 남지 않는 문제([ADR-0008](0008-single-llm-module.md))는 그대로라 비용 집계에 빈틈이 있습니다.
- 지켜야 할 것: 모델 ID·파라미터는 공식 문서로 확인한 뒤 바꿉니다. 키는 `.env`에만 둡니다. 스키마에 새 키워드를 쓰면 `strict_schema`와 테스트(`tests/llm/test_providers.py`)를 같이 고칩니다.

## 다시 볼 때

- `gpt-6.1-sol`이 지원 중단되거나, 구조화 출력·`reasoning.effort` 지원이 바뀔 때
- 비용 한도나 Kill Switch를 붙일 때
- 실제 원문으로 품질을 평가해(7.3) 다른 모델이 낫다고 나올 때
