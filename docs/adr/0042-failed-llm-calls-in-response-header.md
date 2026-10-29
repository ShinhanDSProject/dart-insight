# ADR-0042: LLM을 쓸 수 없어 실패한 요약 요청의 호출 기록은 에러 응답 헤더로 넘기고, backend는 분석을 실패로 끝낼 때도 llm_call에 저장한다

- 상태: 채택
- 결정한 날: 2026-10-29
- 관련: [이슈 #137](https://github.com/ShinhanDSProject/dart-insight/issues/137)(3.2), #113·#117(ADR 코드 대조 검토), [ADR-0004](0004-async-analysis-job.md), [ADR-0005](0005-error-format-and-trace-id.md), [ADR-0008](0008-single-llm-module.md)(이 ADR이 '호출 기록은 분석이 완료될 때만 저장' 부분을 대체), backend `conventions.yaml` EXC-4·LY-2

## 맥락

- ADR-0008은 호출 기록(`CallRecord`)을 분석이 완료될 때만 결과와 함께 `llm_call`에 저장한다고 정했고, '감수하는 점'에 실패한 분석의 호출 기록이 남지 않아 비용 집계에 빈틈이 생긴다고 적었다.
- 코드에서 확인한 사실: ai-server `LlmClient`는 `LlmUnavailable`에 그때까지의 호출 기록(`e.calls`, 다시 시도한 일시 오류·검증 실패로 다시 만든 호출 포함)을 담아 던지지만, `app/api/summaries.py`는 503 `AI_LLM_UNAVAILABLE`만 돌려주고 기록을 버린다. backend `SummaryStore`는 `AnalysisResultService.saveAndComplete` 안에서만 `llm_call`을 넣으므로, 결과 저장이 실패해 트랜잭션이 되돌아가도 기록이 사라진다.
- 에러 응답 본문은 `{code, message, traceId, errors}`로 정했고(api-spec 0절, ADR-0005), backend 컨벤션 EXC-4는 이 모양을 바꾸지 않는다고 정했다. api-spec 4장(에러 코드)도 본문에 필드를 더하는 예외를 두지 않는다. `errors`는 입력값 검증 실패에만 쓴다. 200 응답에 에러를 담지 않는다.
- 지금은 가짜 제공자라 비용이 없지만, 실제 제공자(#50)를 연결하면 실패한 분석의 호출 비용이 집계에서 빠진다.

## 결정

- **전달(ai-server)**: LLM을 쓸 수 없어 실패한 요청(503 `AI_LLM_UNAVAILABLE`)에 그때까지의 호출 기록이 있으면, 에러 본문은 공통 형식 그대로 두고 응답 헤더 `X-Llm-Calls`에 담는다. 값은 호출 기록 배열(200 응답의 `calls`와 같은 객체 모양)의 UTF-8 JSON을 base64url(패딩 있음)로 바꾼 글자다. 기록이 없으면 헤더를 넣지 않는다. 헤더 이름과 에러 만들기는 `app/api/llm_calls.py`(`LLM_CALLS_HEADER`, `llm_unavailable`)에 두고, 지금은 `POST /internal/summaries`만 쓴다. `ApiError`는 헤더를 함께 실을 수 있다(`app/core/errors.py`).
- **받기(backend)**: `AiServerClient`가 에러 응답의 `X-Llm-Calls`를 풀어 `AiServerException.llmCallsJson()`에 담는다(전송 계층만 맡고 모양은 모름). `SummaryService.failedCalls`가 그것을 `LlmCallRow` 목록으로 읽는다(읽지 못하면 빈 목록과 경고 로그, 분석 실패 처리는 그대로).
- **저장(backend)**: `AnalysisRunner`는 요약에서 `AiServerException`을 받으면 먼저 `AnalysisResultService.saveFailedCalls`(별도 트랜잭션, `SummaryStore.saveCalls`)로 호출 기록을 그 분석의 `analysis_id`로 넣고, 그다음 지금처럼 허용 전이표를 거쳐 `FAILED`(`ANALYSIS_SUMMARY_FAILED`)로 바꾼다. 결과 저장이 실패한 경우(`ANALYSIS_SAVE_FAILED`)도 받은 요약의 호출 기록을 같은 방법으로 넣는다. AI 서버 호출은 트랜잭션 밖이고(LY-2), 기록 저장이 실패해도 분석은 실패로 끝난다(로그만 남김). 실패한 분석에는 `summary_item`·결과가 없다. 완료 경로(`saveAndComplete`, 결과와 같은 트랜잭션)는 그대로다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 에러 본문에 `calls` 필드를 더하기 | 공통 에러 형식을 바꾼다(EXC-4, api-spec 0절). 에러 본문을 읽는 모든 곳(backend 파서, 프론트)이 같은 약속을 쓰고, 4장에 본문 확장을 허용하는 규칙이 없다. |
| `errors[]`에 호출 기록을 넣기 | `errors`는 입력값 검증 실패에만 쓴다는 약속을 깨고, `field`·`reason` 글자에 구조 자료를 억지로 넣어야 한다. |
| LLM을 쓸 수 없어도 200으로 답하고 본문에 상태와 `calls`를 담기 | 200 응답에 에러를 담지 않는다는 규칙에 어긋나고, 다른 LLM API(브리핑·답 등)와 실패 처리 방식이 갈린다. |
| ai-server가 실패한 호출 기록을 메모리에 두고 backend가 추적 ID로 따로 가져가기(`GET /internal/llm-calls`) | ai-server에 상태(보관 기간·정리·서버 재시작 때 손실)가 생기고, 한 추적 ID에 여러 요청이 섞일 수 있다. 요청 한 번에 답 한 번으로 끝나는 지금 구조보다 복잡하다. |

## 결과

- 좋아지는 점: 요약 중 LLM을 쓸 수 없어 실패한 분석과 결과 저장에 실패한 분석도 그때까지의 호출 기록이 `llm_call`에 남아, AI 사용 현황의 호출 수·토큰·비용과 분석 단위 평균에 들어간다. 에러 본문 형식은 그대로다.
- 감수하는 점: 호출 기록이 본문이 아니라 헤더에 있어, 응답을 볼 때 헤더도 봐야 한다. 헤더 크기는 기록 수에 비례한다(요청 하나에 다시 만들기 3번 × 다시 시도 3번, 오류 사유는 500자까지라 수 KB 안). 브리핑·전망·대조·답·문장 풀이처럼 분석 밖의 LLM API는 아직 실패 때 기록을 넘기지 않는다. AI 서버가 응답하지 않은 경우(연결 실패·시간 초과)는 ai-server 쪽에서 부른 호출이 있어도 받을 수 없다.
- 지켜야 할 것: 에러 본문에 필드를 더하지 않는다. 에러와 함께 넘길 부가 정보는 헤더로 주고 api-spec 3절에 적는다. 실패 경로의 호출 기록 저장은 상태 전이와 결과 저장 트랜잭션을 바꾸지 않는다(결과가 없는 분석을 `COMPLETED`로 만들지 않음).

## 다시 볼 때

- 실제 LLM 제공자를 연결할 때(#50): 분석 밖의 LLM API에도 같은 헤더를 넣을지
- 호출 기록이 커져 헤더 크기 한도(프록시·서버 설정)에 닿을 때
- AI 서버가 응답 없이 끊긴 요청의 비용도 세야 할 때(ai-server 쪽 기록 저장이 필요)
