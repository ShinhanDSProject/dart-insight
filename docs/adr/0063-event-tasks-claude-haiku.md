# ADR-0063: Claude를 쓸 때 주요 사건 작업 4개(묶기·금액 확인·공시의 의미·신호 이유)는 claude-haiku-5-5로 부른다

- 상태: 채택
- 결정한 날: 2026-11-10
- 관련: #803(0.7), #740(7.9 2차 측정과 사건 카드·신호를 켤지 판단), [ADR-0059](0059-task-model-agent-plan-luna.md)(작업별 모델), [ADR-0062](0062-anthropic-llm-provider.md)(Claude, 기본 모델), [ADR-0057](0057-text-event-llm-limits.md)·[ADR-0058](0058-event-amount-confirmation.md)·[ADR-0060](0060-event-signal-and-sentences.md)(주요 사건)

## 맥락

- 보고서 비교 비용의 대부분은 문장 변화 탭을 처음 열 때 도는 주요 사건 만들기입니다. 기본 모델 `claude-sonnet-5-5` 기준으로 기업당 약 0.8~1.8달러로 어림합니다. 묶기와 금액 확인은 약 0.26달러(7.7 1차 실측, ADR-0060)이고, 공시의 의미와 신호 이유 문장은 약 0.5~1.5달러(어림, ADR-0060)입니다. 요약은 한 번에 약 0.016달러입니다(2026-11-09 실측).
- 가격(100만 토큰당 입력/출력, ADR-0062): `claude-sonnet-5-5`는 2/10달러, `claude-haiku-5-5`는 0.1/0.5달러입니다. Haiku 가격은 프롬프트 10만 토큰 이하일 때이고, 묶기 입력은 측정에서 최대 7.8만 토큰이었습니다(ADR-0057).
- 주요 사건 작업의 task 이름은 `text_event`(`app/events/prompt.py`), `event_amount_pick`(`app/events/amount_pick_prompt.py`), `event_meaning`(`app/events/meaning_prompt.py`), `event_signal_reason`(`app/events/signal_reason_prompt.py`)입니다. 지금은 넷 다 기본 모델로 부릅니다.
- 주요 사건은 backend에서 기본으로 꺼져 있습니다(`TEXT_EVENTS_ENABLED` 기본 false). 켤지는 7.9(#740)의 2차 측정으로 정합니다.
- 사용자 결정(2026-11-09): 주요 사건 작업 4개를 모두 Haiku로, 코드 기본값으로. 사용자 결정(2026-11-10): 이 ADR에서는 실제 모델로 측정하지 않고, Haiku의 품질은 7.9 측정에서 함께 봅니다.

## 결정

- `ai-server/app/core/config.py`의 `DEFAULT_TASK_MODELS["anthropic"]`에 `text_event`·`event_amount_pick`·`event_meaning`·`event_signal_reason`=`claude-haiku-5-5`를 더합니다. `agent_plan=claude-haiku-5-5`(ADR-0062)는 그대로 둡니다.
- OpenAI 쪽 기본값(`agent_plan=gpt-6-luna`)은 바꾸지 않습니다. `LLM_TASK_MODELS`를 정하면 지금처럼 그 값이 코드 기본값보다 앞섭니다. 사건 작업을 Sonnet으로 되돌리려면 `LLM_TASK_MODELS=agent_plan=claude-haiku-5-5`처럼 사건 작업을 빼고 적습니다.
- 프롬프트·검증 규칙은 바꾸지 않으므로 `EVENT_VERSION`과 backend 분석 버전은 올리지 않습니다(ADR-0059와 같은 이유). 이미 만든 사건은 다시 만들지 않습니다. 어떤 모델로 만들었는지는 호출 기록(`llm_call.model`)으로 구분합니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 사건 작업도 기본 모델 `claude-sonnet-5-5`로 두기 | 사건을 켜면 보고서 비교 한 번에 기업당 약 0.8~1.8달러가 들어 요약(약 0.016달러)의 50~100배입니다. 시연·측정 때마다 이 비용이 듭니다. |
| 문장 작업(공시의 의미·신호 이유)만 Haiku로, 묶기·금액 확인은 Sonnet으로 | 문장 작업이 비용의 큰 몫이지만, 묶기 0.26달러도 요약보다 훨씬 큽니다. 사용자가 4개 모두 Haiku로 정했습니다. |
| 바꾸기 전에 분석 하나로 Haiku를 측정하기 | 사건 기능이 꺼져 있어 지금 품질이 화면에 드러나지 않고, 7.9에서 사건 품질을 어차피 잽니다. 같은 측정을 두 번 하지 않으려 7.9로 미룹니다. |
| 코드 기본값 대신 배포 환경의 `LLM_TASK_MODELS`로만 정하기 | 로컬과 배포마다 따로 적어야 하고, 빠뜨리면 조용히 Sonnet 비용이 듭니다. |

## 결과

- 좋아지는 점: 사건을 켰을 때 사건 만들기 비용이 약 1/20로 줄어듭니다(어림 기업당 약 0.04~0.09달러).
- 감수하는 점: Haiku로 사건을 만든 측정 기록이 없습니다. 묶기에서 종류·변화를 덜 정확히 고르거나(신호가 달라짐), 금액 확인과 문장이 검증에 더 자주 실패해 다시 생성하거나 FALLBACK이 될 수 있습니다. 출력이 길어지면 묶기 출력 한도(ADR-0057)에 걸릴 수도 있습니다.
- 지켜야 할 것
  - 7.9(#740) 측정은 이 기본값(Haiku)으로 하고, 사건 수·FAILED·FALLBACK 수·재생성 수·종류·변화 일치율을 호출 기록의 모델과 함께 남깁니다.
  - 사건 작업의 모델을 다시 바꾸면 측정 근거와 함께 새 ADR을 씁니다.

## 다시 볼 때

- 7.9 측정에서 종류·변화 일치율이 낮거나, FAILED·FALLBACK·재생성이 기준보다 많을 때(그 작업만 Sonnet으로 되돌릴지 봅니다)
- 묶기 입력이 10만 토큰을 넘어 Haiku 가격 조건이 달라질 때
- `claude-haiku-5-5`의 가격·구조화 출력 지원이 바뀌거나 지원 중단될 때
