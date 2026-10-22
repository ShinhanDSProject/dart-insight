# ADR-0005: 두 서버가 같은 에러 형식을 쓰고 X-Trace-Id로 요청을 잇는다

- 상태: 채택
- 결정한 날: 2026-10-21
- 관련: [PR #43](https://github.com/ShinhanDSProject/dart-insight/pull/43), [PR #74](https://github.com/ShinhanDSProject/dart-insight/pull/74)(0.5), `docs/api-spec.md` 에러 코드 표, 노션 개발 기준 6장

## 맥락

- 화면은 에러 종류에 따라 다른 예외 상태를 보여 줘야 합니다(와이어프레임 '예외·상태 처리': 비교 불가, 자료 없음, 한도 초과 등).
- 에러는 Spring Boot, FastAPI, OpenDART 세 곳에서 생기고, 분석 하나가 여러 내부 호출을 거칩니다. 로그에서 한 요청의 흐름을 따라갈 방법이 필요합니다.

## 결정

- 에러는 4xx·5xx 상태 코드와 아래 본문으로 돌려줍니다. 200 응답에 에러를 담지 않습니다. FastAPI도 같은 형식을 씁니다(`app/core/errors.py`).

  ```json
  { "code": "ANALYSIS_NOT_COMPARABLE", "message": "사람이 읽는 설명", "traceId": "…", "errors": [] }
  ```

- `code`는 `영역_내용` 대문자 스네이크입니다(영역: `COMMON`, `COMPANY`, `REPORT`, `ANALYSIS`, `DART`, `AI`). 화면은 `code`로 예외 상태를 고릅니다. `errors`는 입력값 검증 실패일 때만 채웁니다. 코드 목록은 `docs/api-spec.md`가 기준입니다. HTTP 에러 코드는 backend `ErrorCode`에 두고, 분석 실패 사유 코드(`ANALYSIS_SUMMARY_FAILED` 등)는 분석 상태와 함께 저장하는 값으로 `docs/api-spec.md`의 분석 실패 코드 표에 둡니다.
- 원문 구조화 결과의 `FAILED`나 분석 상태 `FAILED`처럼 요청은 처리됐고 그 결과가 실패인 경우는 에러가 아니라 결과 상태이므로, 200 응답 본문에 상태와 사유로 담습니다.
- Spring Boot가 요청마다 `X-Trace-Id`를 정합니다(요청 헤더에 있으면 그 값). 로그(MDC)와 에러 본문에 넣고, FastAPI를 부를 때 같은 헤더로 넘깁니다(`TraceContext`, `AiServerClient`). FastAPI도 그 값을 로그와 LLM 호출 기록에 남깁니다.
- 분석 작업은 이 값을 요청 ID로 저장합니다. 나중에 감사 로그로 이어 쓸 수 있습니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 200 응답 본문에 `success: false` | HTTP 도구·모니터링·브라우저가 실패를 알아보지 못합니다. |
| RFC 9457(problem+json) | 표준이지만 화면이 쓰는 것은 코드와 메시지뿐이라, 필드가 적은 자체 형식이 팀이 쓰기 쉽습니다. 필요하면 필드를 옮기기 쉬운 구조입니다. |
| OpenTelemetry 같은 분산 추적 | 수집·조회 도구를 따로 운영해야 합니다. 서버 두 개에는 헤더 하나로 충분합니다. |

## 결과

- 좋아지는 점: 화면의 예외 처리가 `code` 하나로 정해집니다. 사용자가 본 `traceId`로 두 서버 로그를 함께 찾을 수 있습니다.
- 감수하는 점: 에러 코드 목록을 문서와 두 서버 코드에서 함께 맞춰야 합니다.
- 지켜야 할 것: 새 에러 코드는 `docs/api-spec.md`에 먼저 적고 코드를 고칩니다. FastAPI 에러의 `code`는 화면에 그대로 내보내지 않고, backend가 `AI_SERVER_UNAVAILABLE`(분석 중이면 분석 실패 사유 코드)로 바꿉니다. 메시지는 사람이 읽는 설명으로 넘어갈 수 있으므로 FastAPI 에러 메시지에도 내부 정보를 넣지 않습니다.

## 다시 볼 때

- 외부에 API를 공개하거나 서비스가 셋 이상으로 늘어 추적이 헤더 하나로 부족할 때
