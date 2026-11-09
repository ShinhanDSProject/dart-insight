# ADR-0062: 실제 LLM 제공자로 Anthropic Claude Messages API를 더해 기본으로 쓰고, 기본 모델은 claude-sonnet-5-5, Tool 고르기는 claude-haiku-5-5로 둔다

- 상태: 채택
- 결정한 날: 2026-11-09
- 관련: [이슈 #777](https://github.com/ShinhanDSProject/dart-insight/issues/777)(0.7), [ADR-0026](0026-openai-llm-provider.md)(대체), [ADR-0059](0059-task-model-agent-plan-luna.md)(그대로 유효. 작업별 모델 구조와 OpenAI 쪽 기본값은 그대로이고, Claude 쪽 기본값만 더함), [ADR-0008](0008-single-llm-module.md), [ADR-0049](0049-agent-plan-writes-answer.md), 노션 결정 로그 'LLM 제공자·모델 선택'(제공자 변경 항목 추가 필요)

## 맥락

- 지금 실제 제공자는 OpenAI 하나입니다(ADR-0026, `app/llm/providers.py`의 `OpenAIProvider`). 기본 모델은 `gpt-6.1-sol`이고, 에이전트 Tool 고르기(`agent_plan`)만 `gpt-6-luna`입니다(ADR-0059, `app/core/config.py`의 `DEFAULT_TASK_MODELS`).
- 2026-11-06 오후부터 OpenAI 프로젝트 지출 한도 초과(429 `insufficient_quota`)로 실제 모델 호출이 모두 막혔습니다. 팀은 제공자를 Anthropic Claude로 바꾸려 합니다.
- 제공자 SDK는 `providers.py`에서만 가져오고, 다른 코드는 `LlmClient`만 부릅니다(ADR-0008). 그래서 제공자 연결 하나만 더하면 기능 모듈은 고치지 않아도 됩니다.
- 2026-11-09에 Anthropic 공식 자료(Claude API 문서·`anthropic` Python SDK 안내)로 확인한 사실:
  - 모델과 가격(100만 토큰당 입력/출력, [가격 페이지](https://platform.claude.com/docs/en/about-claude/pricing)): `claude-sonnet-5-5` 2/10달러(캐시 읽기 0.1달러), `claude-haiku-5-5` 0.1/0.5달러(프롬프트 10만 토큰 이하), `claude-opus-5-5` 4/20달러. `gpt-6.1-sol`(2/10)·`gpt-6-luna`(0.1/0.5)와 가격대가 같습니다.
  - 호출은 Messages API(`messages.create`)입니다. 시스템 프롬프트는 `system`, 출력 상한은 `max_tokens`입니다.
  - 구조화 출력은 `output_config.format`(`type: "json_schema"`)으로 받습니다. 세 모델 모두 지원합니다. 모든 객체에 `additionalProperties: false`가 있어야 하고, 숫자·글자 길이 제약(`minimum`·`maxLength` 등)과 재귀 스키마는 지원하지 않습니다.
  - 추론 강도는 `output_config.effort`(`low`~`max`)입니다. 기본값은 Sonnet 5.5가 `high`, Haiku 5.5가 `medium`입니다. 두 모델은 생각(adaptive thinking)이 기본으로 켜져 있고, 생각 토큰도 `max_tokens` 안에 듭니다(OpenAI 추론 토큰이 `max_output_tokens` 안에 드는 것과 같습니다). `temperature` 같은 샘플링 값은 받지 않습니다.
  - 응답이 끝난 이유는 `stop_reason`으로 옵니다. `max_tokens`는 출력 한도에서 잘림, `refusal`은 안전 기준에 따른 거절입니다.
  - 프롬프트 캐시는 OpenAI처럼 자동으로 걸리지 않습니다. 블록에 `cache_control`을 넣어야 하고, 캐시 지점은 블록 경계에만 둘 수 있습니다. 요청 끝에 자동으로 두는 방식(최상위 `cache_control`)은 요청마다 바뀌는 끝부분까지 저장해, 끝이 매번 다르면 저장 비용(입력의 1.25배)만 냅니다. 이 모델들의 최소 캐시 길이는 512토큰입니다.
  - 토큰 사용량에서 `input_tokens`는 캐시에서 읽거나 캐시에 쓴 토큰을 뺀 수이고, 캐시 토큰은 `cache_read_input_tokens`·`cache_creation_input_tokens`로 따로 옵니다. 추론 토큰 수는 따로 주지 않습니다.
  - 오류: 429 `rate_limit_error`, 529 `overloaded_error`, 5xx는 다시 시도할 수 있습니다. 402 `billing_error`는 결제 문제라 다시 시도해도 나아지지 않습니다.
  - Sonnet 5.5는 거절했을 때 서버가 같은 요청을 다른 모델로 이어 처리하는 대체(`fallbacks: "default"`, 베타 `server-side-fallback-2026-07-01`)를 Claude API에서 지원합니다. `cyber`·`frontier_llm` 분류의 거절만 `claude-sonnet-5`(입력 2달러, 출력 10달러)로 다시 돌립니다. Haiku 5.5는 지원하지 않습니다.

## 결정

- `app/llm/providers.py`에 `AnthropicProvider`(`name = "anthropic"`)를 더하고 `create_provider`에 등록합니다. 공식 SDK `anthropic`을 `ai-server/requirements.txt`에 버전 고정으로 넣고 이 파일에서만 가져옵니다(ADR-0008). `OpenAIProvider`는 남겨 `LLM_PROVIDER=openai`로 되돌릴 수 있게 합니다.
- 기본으로 쓰는 제공자는 `anthropic`입니다. `ai-server/.env.example`과 문서의 예시를 `LLM_PROVIDER=anthropic`으로 바꿉니다. 키는 지금처럼 `LLM_API_KEY` 하나에서 읽습니다(한 번에 제공자 하나).
- 기본 모델은 `claude-sonnet-5-5`(`ANTHROPIC_DEFAULT_MODEL`)입니다. `LLM_MODEL`로 바꿀 수 있습니다.
- 작업별 모델(ADR-0059)의 코드 기본값을 제공자마다 둡니다. `anthropic`이면 `agent_plan=claude-haiku-5-5`, `openai`이면 지금처럼 `agent_plan=gpt-6-luna`입니다. `LLM_TASK_MODELS`를 정하면 그 값이 앞섭니다.
- 호출 방식
  - `system`에 시스템 프롬프트, `messages`에 user 메시지 하나, `max_tokens`에 요청의 `max_output_tokens`를 넣습니다.
  - `output_schema`가 있으면 `output_config.format`(json_schema)으로 받습니다. 스키마 사본은 `claude_schema`로 맞춥니다. 속성이 있는 객체에 `additionalProperties: false`를 두고, `required`는 그대로 두며 선택 속성에 null을 더하지 않습니다(OpenAI용 `strict_schema`처럼 하면 아래 한도를 바로 넘습니다). 지원하지 않는 제약(`maxItems`·`minimum` 등)은 빼고 `description`에 적으며, 그 제약은 기능 모듈의 검증 함수가 검사합니다. 타입 목록과 `enum`이 함께 있으면 타입마다 나눈 `anyOf`로 바꿉니다(Claude가 400을 냄).
  - 구조화 출력에는 크기 한도가 있습니다. 2026-11-09 실제 API 오류로 확인한 값은 선택 속성 24개, '여러 타입' 필드(타입 목록·`anyOf`) 16개입니다. 이를 넘는 스키마는 `output_config.format` 없이 보내고, JSON 형식과 내용은 `LlmClient`가 검증 함수로 확인해 틀리면 다시 생성합니다(`claude_schema_fits`). 지금 넘는 것은 에이전트 Tool 고르기(`agent_plan`, Tool 23개의 선택 인자 35개)뿐입니다. 2026-11-09 저장해 둔 실제 고르기 요청 10개를 이렇게 `claude-haiku-5-5`로 보냈을 때, 10개 모두 서비스 검증을 첫 시도에 통과했고 고른 Tool은 8개가 `gpt-6.1-sol`과 같았습니다(약 0.01달러).
  - 생각은 모델 기본(adaptive)으로 두고 끄지 않습니다. `LLM_REASONING_EFFORT`가 있으면 `output_config.effort`로 보내고, 없으면 모델 기본값을 씁니다.
  - 캐시 지점(`cache_control` ephemeral)은 요청마다 같은 부분의 끝에 둡니다. 시스템 프롬프트 블록 끝, 그리고 `LlmRequest.user_cache_prefix`가 있으면 user의 그 앞부분 끝입니다. 에이전트 고르기·답 쓰기는 #633에서 앞에 모은 Tool·액션 목록까지를 앞부분으로 넘깁니다(`app/agent/prompt.py`). 요청 끝에 두는 자동 캐시는 쓰지 않습니다. 2026-11-09 실제 고르기 요청 3개를 차례로 보냈을 때 두 번째부터 입력 8,335토큰 중 8,215토큰을 캐시에서 읽었습니다.
  - 모델이 `claude-sonnet-5-5`이면 거절 대체 `fallbacks: "default"`를 켭니다. 대체 모델이 답하면 응답의 `model`이 그 모델이므로 호출 기록에 실제 모델이 남습니다.
- 재시도는 `LlmClient`가 맡습니다. SDK 재시도는 끄고(`max_retries=0`), 호출당 시간 제한은 `with_options(timeout=...)`로 줍니다.
- 오류 나누기: 연결 실패·시간 초과·408·409·429·5xx(529 포함)는 `ProviderTransientError`, 402 `billing_error`와 429 `enforced_spend_limit_reached`(조직 지출 한도)는 `ProviderQuotaError`, 그 밖의 4xx는 `ProviderError`입니다. `stop_reason`이 `refusal`이거나 `max_tokens`이면 `ProviderError`로 끝냅니다.
- 토큰 기록(`ProviderResponse`): `input_tokens`는 `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`(지금처럼 합계), `cached_input_tokens`는 `cache_read_input_tokens`, `reasoning_tokens`는 알 수 없으므로 null입니다(0과 구분).
- 프롬프트는 바꾸지 않으므로 `PROMPT_VERSION`은 올리지 않습니다. 모델과 제공자는 호출 기록으로 구분합니다.
- AI 사용 현황 가격표(`backend/src/main/resources/application.yml`)에 `claude-sonnet-5-5`·`claude-haiku-5-5`와 거절 대체 모델 `claude-sonnet-5`의 가격을 둡니다.
- 품질 측정은 이 결정의 선행 조건이 아니라 병합 뒤 이어서 할 일입니다. 2026-11-09에 채팅·요약을 한 번씩 실제로 확인했고, 다른 작업(브리핑·전망·계획 대조·주요 사건)과 반려·'검토 필요' 비율은 호출 기록으로 이어서 봅니다. `gpt-6.1-sol`보다 눈에 띄게 나쁘면 이 ADR을 고치지 않고 새 ADR을 씁니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| `OpenAIProvider`를 빼고 Claude로 교체 | 코드는 줄지만, 품질이 떨어지면 코드를 되살려야 되돌릴 수 있습니다. 같은 질문으로 두 제공자를 비교 측정하기도 어려워집니다. |
| 기본 모델 `claude-opus-5-5` | 지금 Claude 중 가장 낫지만 비용이 `gpt-6.1-sol`의 2배입니다. 팀은 지금 비용을 지키는 쪽을 골랐습니다. |
| 생각을 끄기(`thinking: between_tools`) | 비용·시간은 줄지만, 지금 `gpt-6.1-sol`도 추론을 쓰고 있어 품질이 떨어질 수 있습니다. 필요하면 `LLM_REASONING_EFFORT`를 낮추는 것부터 해 봅니다. |
| OpenAI 호환 주소로 Claude 부르기 | 구조화 출력·캐시·거절 처리 같은 기능을 제대로 쓸 수 없습니다. 공식 SDK를 씁니다. |
| LangChain `ChatAnthropic` | 재시도·호출 기록은 `LlmClient`가 맡고, LangChain은 쓰지 않기로 했습니다(AGENTS.md). |

## 결과

- 좋아지는 점: OpenAI 지출 한도와 상관없이 실제 모델로 요약·채팅을 돌릴 수 있습니다. 비용은 지금과 같은 가격대입니다. 환경 변수만 바꾸면 OpenAI로 되돌릴 수 있습니다.
- 감수하는 점: 프롬프트는 OpenAI 모델에 맞춰 다듬어졌으므로 반려·'검토 필요' 비율이 달라질 수 있습니다. 추론 토큰 수는 기록되지 않습니다. 거절 대체는 베타 기능입니다.
- 지켜야 할 것
  - 모델 ID·파라미터는 짐작하지 않고 Anthropic 공식 문서로 확인한 뒤 바꿉니다.
  - 키는 팀 공용 키 규칙대로 노션 '공용 키 모음'에 두고 각자 `.env`에만 넣습니다.
  - 스키마에 새 키워드를 쓰면 두 제공자 모두에서 되는지 `tests/llm/test_providers.py`로 확인합니다.
  - 노션 결정 로그 'LLM 제공자·모델 선택'에 제공자 변경을 함께 남깁니다.

## 다시 볼 때

- 품질 측정에서 `claude-sonnet-5-5`나 `claude-haiku-5-5`(Tool 고르기)가 OpenAI 모델보다 반려·'찾지 못함'이 눈에 띄게 많을 때
- 모델이 지원 중단되거나 가격·구조화 출력 지원이 바뀔 때
- 거절 대체가 정식 기능이 되거나 바뀔 때
