# ADR-0063: Claude를 쓸 때 기본 모델은 모든 작업에 claude-haiku-5-5로 둔다

- 상태: 채택
- 결정한 날: 2026-11-10
- 관련: #803(0.7), #740(7.9 2차 측정과 사건 카드·신호를 켤지 판단), [ADR-0062](0062-anthropic-llm-provider.md)(Claude, 기본 모델 `claude-sonnet-5-5` 부분을 이 ADR이 대체), [ADR-0059](0059-task-model-agent-plan-luna.md)(작업별 모델), [ADR-0057](0057-text-event-llm-limits.md)·[ADR-0060](0060-event-signal-and-sentences.md)(주요 사건)

## 맥락

- ADR-0062는 Claude의 기본 모델을 `claude-sonnet-5-5`로, 에이전트 Tool 고르기(`agent_plan`)만 `claude-haiku-5-5`로 정했습니다(`app/llm/providers.py`의 `ANTHROPIC_DEFAULT_MODEL`, `app/core/config.py`의 `DEFAULT_TASK_MODELS`).
- 가격(100만 토큰당 입력/출력, ADR-0062): `claude-sonnet-5-5`는 2/10달러, `claude-haiku-5-5`는 0.1/0.5달러입니다. Haiku 가격은 프롬프트 10만 토큰 이하일 때이고, 가장 큰 입력인 주요 사건 묶기는 측정에서 최대 7.8만 토큰이었습니다(ADR-0057).
- 비용의 대부분은 주요 사건 만들기입니다. Sonnet 기준 기업당 약 0.8~1.8달러로 어림합니다(묶기·금액 확인 약 0.26달러 실측, 사건 문장 약 0.5~1.5달러 어림, ADR-0060). 요약은 한 번에 약 0.016달러, 채팅은 한 번에 약 0.02달러입니다. 개발·시연 중 측정이 잦아 비용을 줄여야 합니다.
- 사용자 결정(2026-11-10): Claude를 쓸 때 기본 모델을 모든 작업에 Haiku로 둡니다. 이 ADR에서는 실제 모델로 측정하지 않고, 주요 사건 품질은 7.9(#740)에서 봅니다.

## 결정

- `ANTHROPIC_DEFAULT_MODEL`을 `claude-haiku-5-5`로 바꿉니다. `LLM_MODEL`을 비우면 요약·풀이·브리핑·전망·계획 대조·주요 사건·근거 질문·에이전트 채팅의 모든 작업이 Haiku입니다.
- 모든 작업이 기본 모델로 Haiku를 쓰므로 `DEFAULT_TASK_MODELS`에서 `anthropic` 기본값(`agent_plan=claude-haiku-5-5`)을 뺍니다. OpenAI 쪽(`agent_plan=gpt-6-luna`)은 그대로입니다.
- Sonnet으로 되돌리려면 환경 변수만 바꿉니다. 전부 되돌리면 `LLM_MODEL=claude-sonnet-5-5`, 작업 하나만이면 `LLM_TASK_MODELS=summary=claude-sonnet-5-5`처럼 적습니다.
- 거절 대체(`fallbacks: "default"`)는 Claude API에서 `claude-sonnet-5-5`만 지원하므로(ADR-0062) 기본 모델에서는 켜지지 않습니다. `ANTHROPIC_FALLBACK_MODELS`는 그대로 두어 Sonnet으로 되돌리면 다시 켜집니다.
- 프롬프트·검증 규칙은 바꾸지 않으므로 `*_VERSION`과 backend 분석 버전은 올리지 않습니다(ADR-0059와 같은 이유). 이미 만든 결과는 다시 만들지 않습니다. 어떤 모델로 만들었는지는 호출 기록(`llm_call.model`)으로 구분합니다.
- Claude는 생각 토큰도 출력 한도(`max_tokens`)에 듭니다. 2026-11-10 실제 호출에서 Haiku가 에이전트 답 쓰기(`agent_answer`)의 한도 1,000토큰에서 잘려 채팅이 실패했으므로, 그 한도를 Tool 고르기와 같은 3,000으로 올립니다(`app/agent/prompt.py`). 답 글 길이는 답 형식의 글자 수 상한이 따로 막습니다.
- ADR-0062에서 바뀌는 것은 기본 모델과 `agent_plan` 기본값뿐입니다. 제공자 구조·구조화 출력·캐시·오류 처리는 그대로입니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| ADR-0062대로 기본 Sonnet, Tool 고르기만 Haiku | 사건을 켜면 기업당 약 0.8~1.8달러로 요약의 50~100배이고, 요약·채팅도 Haiku보다 약 20배 비쌉니다. |
| 주요 사건 작업 4개만 Haiku로(작업별 모델) | 사건 비용은 줄지만 요약·채팅·풀이가 여전히 Sonnet 가격입니다. 사용자가 모든 작업을 Haiku로 정했습니다. |
| 바꾸기 전에 작업마다 Haiku 품질을 측정하기 | 작업이 많아 측정 비용과 시간이 큽니다. 되돌리기가 환경 변수 하나라, 문제가 보이는 작업만 되돌립니다. |

## 결과

- 좋아지는 점: 모든 LLM 호출 비용이 약 1/20로 줄어듭니다(사건을 켜도 기업당 어림 약 0.04~0.09달러). 작업별 모델 기본값이 없어져 설정이 단순해집니다.
- 감수하는 점: Haiku로 측정한 기록은 에이전트 Tool 고르기(ADR-0062, 10개)뿐입니다. 요약 인용·등급, 채팅 답, 사건 묶기의 종류·변화에서 검증 실패·재생성·'검토 필요'가 늘 수 있습니다. 거절 대체가 없어 안전 분류로 거절되면 그 호출은 실패로 끝납니다.
- 지켜야 할 것
  - 7.9(#740) 측정은 이 기본값(Haiku)으로 하고, 사건 수·FAILED·FALLBACK·재생성 수와 호출 기록의 모델을 함께 남깁니다.
  - 작업 하나를 Sonnet으로 되돌리면 측정 근거와 함께 이 ADR을 대체하는 새 ADR을 씁니다.

## 다시 볼 때

- 호출 기록에서 반려·재생성·'검토 필요'·거절 비율이 Sonnet 때보다 눈에 띄게 늘 때
- 7.9 측정에서 사건 종류·변화 일치율이 낮을 때
- 묶기 입력이 10만 토큰을 넘어 Haiku 가격 조건이 달라질 때, `claude-haiku-5-5`의 가격·지원이 바뀔 때
