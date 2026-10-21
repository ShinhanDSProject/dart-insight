# API 명세

> API를 바꾸는 PR에서 이 문서도 함께 고칩니다. 경로, 에러 형식, 추적 ID, 날짜·금액 같은 공통 규칙은 노션 [개발 기준](https://app.notion.com/p/400b6afffc6f813aac54dd697afc9d8e) 6장과 `AGENTS.md`를 따릅니다.

## 문서 정보

| 항목 | 내용 |
| --- | --- |
| 상태 | 초안 (M1 범위) |
| 담당 | 백엔드·프론트 |
| 마지막 수정 | 2026-10-21 |
| 관련 문서 | ERD(`docs/erd.md`), [화면 와이어프레임](https://app.notion.com/p/c0f540f74d92496c9c20f23867afc15a), 이슈 #47 |

## 0. 공통

- 기준 주소: backend `http://localhost:8080`, ai-server `http://localhost:8000`(내부 전용)
- 요청·응답은 JSON(UTF-8), 필드는 camelCase입니다.
- 날짜는 `YYYY-MM-DD`(한국 시간), 시각은 `YYYY-MM-DDTHH:mm:ss`(한국 시간)입니다.
- 금액은 원 단위 정수입니다. 단위 변환(백만원·억원)은 화면에서 합니다.
- 비율은 소수입니다(`0.153` = 15.3%).
- 응답 헤더 `X-Trace-Id`에 추적 ID가 있습니다. 요청에 `X-Trace-Id`를 넣으면 그 값을 그대로 씁니다. 단, 영문·숫자·`-`로 된 64자 이하 값만 쓰고, 그 밖의 값은 새 ID로 바꿉니다.
- 로그인은 MVP에 없습니다(P2).

### 에러 형식

4xx·5xx 상태 코드와 함께 아래 형식으로 돌려줍니다. 200 응답에 에러를 담지 않습니다.

```json
{
  "code": "COMMON_INVALID_INPUT",
  "message": "입력값을 확인해 주세요.",
  "traceId": "3f1c9a0e7b2d4c11",
  "errors": [{ "field": "query", "reason": "2자 이상 입력해 주세요." }]
}
```

`errors`는 입력값 검증 실패일 때만 들어 있고, 그 밖에는 빈 배열입니다.

### 공통 값

| 이름 | 값 |
| --- | --- |
| `reportType` | `ANNUAL` 사업보고서, `HALF` 반기보고서, `Q1` 1분기보고서, `Q3` 3분기보고서 |
| `correction` | `ORIGINAL` 원본, `CORRECTED` 정정(보고서명 앞머리에 '정정'), `UNKNOWN` 확인 안 됨(비고 `rm`에 '정'만 있음) |
| `disclosureType` | OpenDART 공시상세유형. `A001` 사업보고서, `A002` 반기보고서, `A003` 분기보고서 |
| `financialDataStatus` | `UNKNOWN` 확인 전, `AVAILABLE` 재무 자료 있음, `NOT_AVAILABLE` 재무 자료 없음. 재무제표 API가 2015 사업연도부터 제공하므로 그 전 보고서는 받아 보지 않아도 `NOT_AVAILABLE` |
| `basis` | `YOY` 전년 동기, `PREV` 직전 기간, `CUSTOM` 직접 선택 |
| `status` (분석) | `PENDING` 대기, `RUNNING` 진행, `COMPLETED` 완료, `FAILED` 실패 |
| `step` (분석) | `RECEIVED` 요청 접수, `COMPARING` 보고서 비교, `VERIFYING` 근거 확인, `DONE` 완료 |
| `sjDiv` | `BS` 재무상태표, `IS` 손익계산서, `CIS` 포괄손익계산서, `CF` 현금흐름표, `SCE` 자본변동표 |
| `fsDiv` | `CFS` 연결, `OFS` 별도 |
| `amountBasis` | `POINT` 시점(재무상태표), `CUMULATIVE` 누적, `QUARTER` 3개월 |

## 1. 엔드포인트 요약

| 메서드 | 경로 | 설명 | 이슈 | 화면 | 상태 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/companies` | 기업 검색 | #8 (1.1) | W-01 ① | 초안 |
| GET | `/api/companies/{corpCode}` | 기업 정보 | #8 (1.1) | W-01 ② | 초안 |
| GET | `/api/companies/{corpCode}/reports` | 기업별 정기보고서 목록 | #9 (1.2), #10 (1.3) | W-01 ② | 초안 |
| GET | `/api/reports/{rceptNo}` | 보고서 메타데이터 | #10 (1.3), #11 (1.4) | W-01 ② | 초안 |
| GET | `/api/companies/{corpCode}/report-pairs` | 비교 기준에 맞는 보고서 쌍 | #12 (2.1) | W-01 ② | 초안 |
| POST | `/api/comparability-checks` | 비교 가능성 검증 | #13 (2.2) | W-01 ③ | 초안 |
| POST | `/api/analyses` | 분석 요청 | #14 (2.3) | W-01 ③ → W-02 | 초안 |
| GET | `/api/analyses/{analysisId}` | 분석 상태·단계 | #14 (2.3) | W-02, W-03 | 초안 |
| GET | `/api/analyses/{analysisId}/financial-changes` | 재무 수치 변화 목록 | #15 (2.4), #19 (3.1) | W-03 ② | 초안 |
| GET | `/api/analyses/{analysisId}/financial-changes/{changeId}` | 수치 근거 상세 | #21 (3.3) | W-03 ② | 초안 |
| GET | `/api/system/health` | 서비스 연결 상태 | #48 (0.5) | — | 초안 |

## 2. 엔드포인트 상세

### GET /api/companies — 기업 검색

- 이슈: #8 (1.1) · 화면: W-01 ①
- 회사명 일부나 종목코드로 찾습니다. 상장사와 정확히 일치하는 이름을 먼저 보여 줍니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `query` | string | 예 | 회사명 또는 종목코드. 앞뒤 공백을 뺀 2자 이상 |
| query | `limit` | number | 아니오 | 최대 개수. 기본 20, 최대 50 |

**응답 200**

```json
{
  "items": [
    { "corpCode": "00126380", "corpName": "삼성전자", "stockCode": "005930", "listed": true }
  ]
}
```

결과가 없으면 `items`가 빈 배열입니다(에러 아님).

**에러**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `query`가 비었거나 2자 미만 |
| 503 | `COMPANY_LIST_NOT_LOADED` | 기업 목록(4.4)을 아직 받지 않음 |

### GET /api/companies/{corpCode} — 기업 정보

**응답 200**: 검색 결과 항목과 같은 모양입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |

### GET /api/companies/{corpCode}/reports — 정기보고서 목록

- 이슈: #9 (1.2), #10 (1.3) · 화면: W-01 ②
- 저장된 목록이 없거나 24시간이 지났으면 OpenDART에서 다시 받습니다(4.1). 다시 받다 실패해도 저장된 목록이 있으면 그 목록을 돌려주고, `refreshError`에 실패 이유를 담습니다.
- 대상 기간 끝(`periodEnd`)이 최근인 순서입니다. 같은 기간이면 제출일이 최근인 순서입니다.
- 사업·반기·분기보고서(`A001`~`A003`) 가운데 12월 결산 보고서만 돌려줍니다(잠정안). 정정된 보고서는 최종본만 들어 있습니다.
- 보고서가 하나도 없으면 `items`가 빈 배열입니다(에러 아님).

**응답 200**

```json
{
  "corpCode": "00126380",
  "fetchedAt": "2026-10-21T14:05:12",
  "refreshError": null,
  "items": [
    {
      "rceptNo": "20260814001234",
      "reportName": "반기보고서 (2026.06)",
      "reportType": "HALF",
      "disclosureType": "A002",
      "fiscalYear": 2026,
      "periodEnd": "2026-06-30",
      "receivedAt": "2026-08-14",
      "correction": "ORIGINAL",
      "financialDataStatus": "UNKNOWN",
      "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814001234"
    }
  ]
}
```

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |
| 502 | `DART_REQUEST_FAILED` | OpenDART 호출 실패이고 저장된 목록도 없음 |
| 503 | `DART_RATE_LIMITED` | OpenDART 호출 한도 초과(020)이고 저장된 목록도 없음 |
| 503 | `DART_KEY_MISSING` | 서버에 OpenDART 키가 설정되지 않음 |

### GET /api/reports/{rceptNo} — 보고서 메타데이터

- 이슈: #10 (1.3), #11 (1.4)
- 저장된 보고서만 돌려줍니다. OpenDART를 부르지 않습니다.
- 대상 기간(`fiscalYear`·`periodEnd`)과 제출일(`receivedAt`)은 서로 다른 필드입니다.
- `latest`: 마지막으로 받은 OpenDART 최신 목록에 있는 보고서인지입니다. 정정 공시가 나와 최신 목록에서 빠진 보고서는 `false`입니다(이미 분석에 쓴 보고서를 열 때 필요).

**응답 200**: 목록 항목 필드에 `corpCode`, `corpName`, `remark`(비고 원문, 없으면 null), `filerName`(제출인), `latest`를 더합니다.

```json
{
  "rceptNo": "20260814001234",
  "corpCode": "00126380",
  "corpName": "삼성전자",
  "reportName": "반기보고서 (2026.06)",
  "reportType": "HALF",
  "disclosureType": "A002",
  "fiscalYear": 2026,
  "periodEnd": "2026-06-30",
  "receivedAt": "2026-08-14",
  "correction": "ORIGINAL",
  "remark": null,
  "filerName": "삼성전자",
  "latest": true,
  "financialDataStatus": "AVAILABLE",
  "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814001234"
}
```

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `REPORT_NOT_FOUND` | 저장되지 않은 접수번호(먼저 목록을 조회해야 함) |

### GET /api/companies/{corpCode}/report-pairs — 비교 보고서 쌍

- 이슈: #12 (2.1) · 화면: W-01 ②
- 현재 보고서는 그대로 두고, 비교 기준에 따라 이전 보고서만 고릅니다. 직접 선택(`CUSTOM`)은 이 API를 쓰지 않고 화면에서 목록 중에 고릅니다.
- 이전 보고서는 정기보고서 목록(정정 공시는 최종본)에서만 고릅니다. 맞는 보고서가 없으면 다른 보고서로 대신하지 않습니다.
- `YOY`(전년 동기): 같은 종류의 1년 전 보고서
- `PREV`(직전 기간): 1분기 ← 전년 사업보고서, 반기 ← 1분기, 3분기 ← 반기, 사업 ← 3분기(잠정안)

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `basis` | string | 예 | `YOY` 또는 `PREV` |
| query | `currentRceptNo` | string | 아니오 | 없으면 가장 최근 보고서 |

**응답 200**

```json
{
  "basis": "YOY",
  "current": { "rceptNo": "20260814001234", "reportType": "HALF", "periodEnd": "2026-06-30" },
  "previous": { "rceptNo": "20250814000987", "reportType": "HALF", "periodEnd": "2025-06-30" },
  "reason": null
}
```

`current`·`previous`는 목록 항목과 같은 모양입니다(위 예시는 일부 필드만 적음). 고르지 못하면 null이고 `reason`에 이유가 들어 있습니다.

| `reason.code` | 언제 |
| --- | --- |
| `NO_BASE_REPORT` | 비교 기준에 맞는 이전 보고서가 목록에 없음(`previous`가 null) |
| `NO_REPORTS` | 기업의 정기보고서가 하나도 없음(`current`·`previous` 모두 null) |

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `basis`가 없거나 `YOY`·`PREV`가 아님 |
| 404 | `COMPANY_NOT_FOUND`, `REPORT_NOT_FOUND` | 없는 기업, 저장되지 않았거나 다른 기업의 보고서 |
| 502·503 | `DART_REQUEST_FAILED`, `DART_RATE_LIMITED`, `DART_KEY_MISSING` | 정기보고서 목록을 다시 받아야 하는데(4.1) OpenDART 호출이 실패하고 저장된 목록도 없음. 저장된 목록이 있으면 그 목록으로 고름 |

### POST /api/comparability-checks — 비교 가능성 검증

- 이슈: #13 (2.2) · 화면: W-01 ③
- 필요하면 두 보고서의 재무제표를 OpenDART에서 받아(4.5) 자료 준비 상태를 확인합니다.
- 비교할 수 없어도 200으로 결과를 돌려줍니다. 분석 요청(`POST /api/analyses`)은 비교할 수 없으면 422입니다.

**요청 본문**

```json
{ "corpCode": "00126380", "currentRceptNo": "20260814001234", "previousRceptNo": "20250814000987", "basis": "YOY" }
```

**응답 200**

```json
{
  "comparable": true,
  "level": "FULL",
  "fsDiv": "CFS",
  "checks": [
    { "item": "COMPANY", "label": "기업", "status": "OK", "detail": "두 보고서 모두 삼성전자입니다." },
    { "item": "REPORT_PERIOD", "label": "보고서 종류·기간", "status": "OK", "detail": "2025 반기 → 2026 반기 (전년 동기)" },
    { "item": "FINANCIAL_BASIS", "label": "수치 기준(연결·단위)", "status": "OK", "detail": "연결, 원(KRW)" },
    { "item": "CORRECTION", "label": "정정 여부", "status": "OK", "detail": "두 보고서 모두 원본입니다." },
    { "item": "DATA_READY", "label": "자료 준비 상태", "status": "OK", "detail": "두 보고서의 재무 자료가 있습니다." }
  ],
  "reasons": []
}
```

| 필드 | 설명 |
| --- | --- |
| `level` | `FULL` 모든 재무제표 비교, `BALANCE_SHEET_ONLY` 기간이 달라 재무상태표만 비교, `NOT_COMPARABLE` 비교 불가 |
| `checks[].status` | `OK`, `WARN`(비교는 하지만 알릴 것), `FAIL`(비교 불가 사유) |
| `reasons[]` | 비교할 수 없는 사유 `{ code, message, nextAction }` |

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 필수 값 없음 |
| 404 | `REPORT_NOT_FOUND` | 없는 보고서 |

### POST /api/analyses — 분석 요청

- 이슈: #14 (2.3) · 화면: W-01 ③ → W-02
- 같은 기업·보고서 쌍·비교 기준·분석 버전으로 완료된 결과가 있으면 새로 만들지 않고 그 결과를 돌려줍니다(200). 진행 중인 작업이 있으면 그 작업을 돌려줍니다(202).

**요청 본문**: 비교 가능성 검증과 같습니다.

**응답 202 / 200**

```json
{ "analysisId": 42, "status": "PENDING", "step": "RECEIVED", "reused": false }
```

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 필수 값 없음 |
| 404 | `REPORT_NOT_FOUND` | 없는 보고서 |
| 422 | `ANALYSIS_NOT_COMPARABLE` | 비교 가능성 검증을 통과하지 못함 |

### GET /api/analyses/{analysisId} — 분석 상태

- 이슈: #14 (2.3) · 화면: W-02(1초마다 조회), W-03

**응답 200**

```json
{
  "analysisId": 42,
  "corpCode": "00126380",
  "corpName": "삼성전자",
  "basis": "YOY",
  "fsDiv": "CFS",
  "current": { "rceptNo": "20260814001234", "reportName": "반기보고서 (2026.06)" },
  "previous": { "rceptNo": "20250814000987", "reportName": "반기보고서 (2025.06)" },
  "status": "RUNNING",
  "step": "COMPARING",
  "steps": [
    { "step": "RECEIVED", "label": "요청 접수", "state": "DONE" },
    { "step": "COMPARING", "label": "보고서 비교", "state": "ACTIVE" },
    { "step": "VERIFYING", "label": "근거 확인", "state": "PENDING" },
    { "step": "DONE", "label": "완료", "state": "PENDING" }
  ],
  "error": null,
  "createdAt": "2026-10-21T14:06:00",
  "completedAt": null
}
```

`current`·`previous`는 목록 항목과 같은 모양입니다. 실패하면 `status`가 `FAILED`, 실패한 단계의 `state`가 `FAILED`이고 `error`에 `{ "code", "message", "retryable" }`이 들어 있습니다. 결과를 저장하기 전에는 `COMPLETED`가 되지 않습니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 ID |

### GET /api/analyses/{analysisId}/financial-changes — 재무 수치 변화

- 이슈: #15 (2.4), #19 (3.1) · 화면: W-03 ②

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `sjDiv` | string | 아니오 | 재무제표 종류. 기본 `BS` |
| query | `changedOnly` | boolean | 아니오 | `true`면 값이 바뀌었거나 계산할 수 없는 항목만. 기본 `false` |

**응답 200**

```json
{
  "analysisId": 42,
  "fsDiv": "CFS",
  "statements": [
    { "sjDiv": "BS", "label": "재무상태표", "total": 58, "changed": 41 },
    { "sjDiv": "IS", "label": "손익계산서", "total": 21, "changed": 19 }
  ],
  "items": [
    {
      "changeId": 901,
      "sjDiv": "IS",
      "accountName": "매출액",
      "amountBasis": "CUMULATIVE",
      "previousAmount": 145000000000000,
      "currentAmount": 152000000000000,
      "changeAmount": 7000000000000,
      "changeRate": 0.048276,
      "direction": "UP",
      "calcStatus": "OK",
      "calcMessage": null
    }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `direction` | `UP`, `DOWN`, `SAME`. 계산하지 못하면 null |
| `calcStatus` | ERD의 `financial_change.calc_status`와 같은 값 |
| `calcMessage` | 계산하지 못한 사유(예: "이전 값이 0이라 증감률을 계산하지 않습니다.") |

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 ID |
| 409 | `ANALYSIS_NOT_READY` | 분석이 아직 완료되지 않음 |

### GET /api/analyses/{analysisId}/financial-changes/{changeId} — 수치 근거 상세

- 이슈: #21 (3.3) · 화면: W-03 ② 계정 선택

**응답 200**: 목록 항목에 아래를 더합니다.

```json
{
  "changeId": 901,
  "accountName": "매출액",
  "accountKey": "ifrs-full_Revenue",
  "currency": "KRW",
  "formula": "152,000,000,000,000 − 145,000,000,000,000 = 7,000,000,000,000",
  "rateFormula": "7,000,000,000,000 ÷ 145,000,000,000,000 = 4.83%",
  "previous": {
    "rceptNo": "20250814000987",
    "reportName": "반기보고서 (2025.06)",
    "periodName": "제 56 기 반기",
    "sjDiv": "IS",
    "accountId": "ifrs-full_Revenue",
    "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000987"
  },
  "current": { "rceptNo": "20260814001234", "...": "previous와 같은 모양" }
}
```

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND`, `FINANCIAL_CHANGE_NOT_FOUND` | 없는 분석·항목 |

### GET /api/system/health — 연결 상태

- 이슈: #48 (0.5)

**응답 200**

```json
{ "backend": "UP", "aiServer": "UP" }
```

AI 서버가 응답하지 않으면 `aiServer`가 `DOWN`입니다(200 그대로).

## 3. 내부 API (Spring Boot → FastAPI)

외부에 열지 않습니다. 요청 헤더에 항상 `X-Trace-Id`를 넣습니다. 에러 형식은 외부 API와 같습니다.

| 메서드 | 경로 | 설명 | 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| GET | `/internal/health` | AI 서버 상태 | #48 (0.5) | 초안 |
| GET | `/health` | AI 서버 자체 상태(사람·배포 도구가 확인용으로 씀. backend는 `/internal/health`를 부름) | #44 (0.1) | 초안 |
| POST | `/internal/...` | 원문 구조화·문장 변경 탐지·요약 | 4.2, 2.5, 3.2 | M2에서 정함 |

## 4. 에러 코드

`code`는 `영역_내용` 형식의 대문자 스네이크입니다. 화면은 `code`를 보고 예외 상태를 고릅니다.

| code | 상태 | 뜻 | 화면 처리 |
| --- | --- | --- | --- |
| `COMMON_INVALID_INPUT` | 400 | 입력값이 형식에 맞지 않음 | 입력창 아래에 `errors[].reason` |
| `COMMON_NOT_FOUND` | 404 | 없는 경로 | 공통 오류 안내 |
| `COMMON_METHOD_NOT_ALLOWED` | 405 | 지원하지 않는 메서드 | 공통 오류 안내 |
| `COMMON_INTERNAL_ERROR` | 500 | 알 수 없는 서버 오류 | 공통 오류 안내와 추적 ID |
| `COMPANY_NOT_FOUND` | 404 | 없는 기업 | 검색으로 돌아가기 |
| `COMPANY_LIST_NOT_LOADED` | 503 | 기업 목록을 아직 받지 않음 | 관리자에게 기업 목록 갱신 요청 안내 |
| `REPORT_NOT_FOUND` | 404 | 없는 보고서 | 보고서 목록 다시 불러오기 |
| `ANALYSIS_NOT_FOUND` | 404 | 없는 분석 | 처음부터 다시 |
| `ANALYSIS_NOT_COMPARABLE` | 422 | 비교할 수 없는 보고서 쌍 | W-01 ③ 사유와 다음 행동 |
| `ANALYSIS_NOT_READY` | 409 | 분석이 끝나지 않음 | W-02로 이동 |
| `ANALYSIS_CHANGE_NOT_FOUND` | 404 | 없는 계정 항목 | 목록 다시 불러오기 |
| `DART_REQUEST_FAILED` | 502 | OpenDART 호출 실패 | 잠시 뒤 다시 시도 |
| `DART_RATE_LIMITED` | 503 | OpenDART 호출 한도 초과(020) | 내일 다시 시도, 저장된 자료 사용 |
| `DART_KEY_MISSING` | 503 | 서버에 OpenDART 키가 없음 | 관리자 안내 |
| `AI_SERVER_UNAVAILABLE` | 503 | AI 서버가 응답하지 않음 | 잠시 뒤 다시 시도 |

## 5. 정하지 못한 것

| 질문 | 잠정안 | 결정 로그 |
| --- | --- | --- |
| 기본 비교 기준 | 전년 동기(`YOY`). 와이어프레임 예시 | [기본 비교 기준](https://app.notion.com/p/400b6afffc6f81e79212d26a29aecca6) |
| 직전 기간의 정의 | 바로 앞 정기보고서(1분기 ← 전년 사업보고서, 반기 ← 1분기, 3분기 ← 반기, 사업 ← 3분기) | [기본 비교 기준](https://app.notion.com/p/400b6afffc6f81e79212d26a29aecca6) |
| 이전 값 기준 | 이전 보고서의 원래 값 | [이전 값 기준](https://app.notion.com/p/400b6afffc6f81178a7cc9fafd980394) |
| 비교 가능성 규칙 | 2.2 PR에 적은 규칙 | [비교 가능성 규칙](https://app.notion.com/p/400b6afffc6f8178b798e570fe37828b) |
| 분석 대상 기업 범위 | 12월 결산 보고서만(사업보고서 기간이 12월인 회사) | [분석 대상 기업 범위](https://app.notion.com/p/400b6afffc6f813cadd6ff8ecce0a780) |
