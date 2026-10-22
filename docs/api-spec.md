# API 명세

> API를 바꾸는 PR에서 이 문서도 함께 고칩니다. 경로, 에러 형식, 추적 ID, 날짜·금액 같은 공통 규칙은 노션 [개발 기준](https://app.notion.com/p/400b6afffc6f813aac54dd697afc9d8e) 6장과 `AGENTS.md`를 따릅니다.

## 문서 정보

| 항목 | 내용 |
| --- | --- |
| 상태 | 초안 (M1 범위) |
| 담당 | 백엔드·프론트 |
| 마지막 수정 | 2026-10-22 |
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
| `financialDataStatus` | `UNKNOWN` 확인 전(아직 받아 보지 않음), `AVAILABLE` 재무 자료 있음, `NOT_AVAILABLE` 재무 자료 없음. 받아 둔 결과(4.5)로 정하고 목록 조회에서는 OpenDART를 부르지 않음. `NOT_AVAILABLE`: 2015 사업연도 이전, 연결·별도 모두 `013`, 또는 받은 자료가 다른 접수번호(정정본) 것 |
| `basis` | `YOY` 전년 동기, `PREV` 직전 기간, `CUSTOM` 직접 선택 |
| `status` (분석) | `PENDING` 대기, `RUNNING` 진행, `COMPLETED` 완료, `FAILED` 실패 |
| `step` (분석) | `RECEIVED` 요청 접수, `COMPARING` 보고서 비교, `VERIFYING` 근거 확인, `DONE` 완료 |
| `sjDiv` | `BS` 재무상태표, `IS` 손익계산서, `CIS` 포괄손익계산서, `CF` 현금흐름표, `SCE` 자본변동표 |
| `fsDiv` | `CFS` 연결, `OFS` 별도 |
| `amountBasis` | `POINT` 시점(재무상태표), `CUMULATIVE` 누적, `QUARTER` 3개월 |
| `textStatus` (분석) | 문장 비교 상태. `COMPLETED` 끝까지 비교, `PARTIAL` 원문 일부를 읽지 못했을 수 있음, `FAILED` 비교하지 못함(문장 변경이 없다는 뜻이 아님). 완료 전이면 null |
| `changeType` (문장) | `ADDED` 추가, `DELETED` 삭제(문서에서 빠짐. 사업·계약 종료로 해석하지 않음), `MODIFIED` 수정, `REVIEW_NEEDED` 검토 필요(두 보고서의 항목을 짝짓지 못함) |

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
| GET | `/api/analyses/{analysisId}/text-changes` | 문장·표 변경 목록 | #16 (2.5) | W-03 ③ | 초안 |
| GET | `/api/analyses/{analysisId}/text-changes/{changeId}` | 문장·표 근거 상세 | #22 (3.4) | W-03 ③ | 초안 |
| GET | `/api/analyses/{analysisId}/summary` | 근거 기반 요약·설명 | #20 (3.2) | W-03 ① | 초안 |
| GET | `/api/analyses/{analysisId}/documents/{side}` | 분석 보고서 원문 목차 | #23 (3.5) | W-03 ④ | 초안 |
| GET | `/api/analyses/{analysisId}/documents/{side}/sections/{sectionNo}` | 원문 한 항목의 문단·표 | #23 (3.5) | W-03 ④ | 초안 |
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
- 필요하면 두 보고서의 재무제표를 OpenDART에서 받아(4.5) 자료 준비 상태를 확인합니다. 받아 둔 결과가 있으면 다시 부르지 않습니다.
- 비교할 수 없어도 200으로 결과를 돌려줍니다. 분석 요청(`POST /api/analyses`)은 비교할 수 없으면 422입니다.
- 비교할 수 없으면 다른 보고서로 대신하거나 수치를 만들지 않고, 사유와 다음 행동을 돌려줍니다.

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
  "current": { "rceptNo": "20260814001234", "reportType": "HALF", "periodEnd": "2026-06-30" },
  "previous": { "rceptNo": "20250814000987", "reportType": "HALF", "periodEnd": "2025-06-30" },
  "statements": [
    { "sjDiv": "BS", "label": "재무상태표", "comparable": true, "amountBasis": "POINT", "note": null },
    { "sjDiv": "IS", "label": "손익계산서", "comparable": true, "amountBasis": "CUMULATIVE", "note": null }
  ],
  "checks": [
    { "item": "COMPANY", "label": "기업", "status": "OK", "detail": "두 보고서 모두 삼성전자의 보고서예요." },
    { "item": "REPORT_PERIOD", "label": "보고서 종류·기간", "status": "OK", "detail": "2025 반기 → 2026 반기 (전년 동기)" },
    { "item": "FINANCIAL_BASIS", "label": "수치 기준(연결·단위)", "status": "OK", "detail": "연결, 원(KRW)" },
    { "item": "CORRECTION", "label": "정정 여부", "status": "OK", "detail": "두 보고서 모두 정정 없이 원본이에요." },
    { "item": "DATA_READY", "label": "자료 준비 상태", "status": "OK", "detail": "두 보고서의 재무 자료가 있어요." }
  ],
  "reasons": []
}
```

`current`·`previous`는 보고서 목록 항목과 같은 모양입니다(위 예시는 일부 필드만 적음). `statements`는 BS, IS, CIS, CF, SCE 다섯 개가 늘 들어 있습니다(위 예시는 두 개만 적음).

| 필드 | 설명 |
| --- | --- |
| `level` | `FULL` 다섯 재무제표 모두 비교, `PARTIAL` 기간 길이가 달라 일부만 비교, `NOT_COMPARABLE` 비교 불가 |
| `fsDiv` | 비교에 쓸 재무제표 기준. 두 보고서 모두 연결이 있으면 `CFS`, 아니면 둘 다 있는 `OFS`. 비교 불가면 null |
| `statements[]` | 재무제표 종류별 비교 여부와 금액 기준(`amountBasis`). 비교하지 않으면 `note`에 이유 |
| `checks[].status` | `OK`, `WARN`(비교는 하지만 알릴 것), `FAIL`(비교 불가 사유), `SKIPPED`(앞 항목이 실패해 확인하지 않음) |
| `reasons[]` | 비교할 수 없는 사유 `{ code, message, nextAction }` |

재무제표 종류별 비교 규칙(잠정안, 결정 로그 '비교 가능성 규칙'):

| 두 보고서 | 재무상태표 | 손익·포괄손익 | 현금흐름·자본변동 |
| --- | --- | --- | --- |
| 같은 종류(전년 동기 등) | 시점 | 누적 | 누적 |
| 종류가 다르고 둘 다 분·반기(직전 기간 등) | 시점 | 3개월 | 비교 안 함 |
| 한쪽이 사업보고서이고 종류가 다름 | 시점 | 비교 안 함(사업보고서에 4분기 3개월 금액이 없음) | 비교 안 함 |

| `reasons[].code` | 언제 |
| --- | --- |
| `DIFFERENT_COMPANY` | 두 보고서 중 요청한 기업이 아닌 보고서가 있음 |
| `SAME_REPORT` | 같은 보고서를 두 번 고름 |
| `PREVIOUS_NOT_EARLIER` | 비교 보고서의 대상 기간이 현재 보고서보다 앞서지 않음 |
| `REPLACED_BY_CORRECTION` | 정정 공시로 대체돼 최신 목록에 없는 보고서 |
| `NO_FINANCIAL_DATA` | 연결·별도 모두 재무제표가 없음(2015 이전 포함) |
| `DATA_VERSION_MISMATCH` | OpenDART 재무 자료가 다른 접수번호(정정본) 기준 |
| `NO_COMMON_BASIS` | 두 보고서에 같은 기준(연결·별도)의 재무제표가 없음 |
| `CURRENCY_MISMATCH` | 두 보고서의 통화가 다름 |

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 필수 값 없음 |
| 404 | `REPORT_NOT_FOUND` | 저장되지 않은 보고서 |
| 502·503 | `DART_REQUEST_FAILED`, `DART_RATE_LIMITED`, `DART_KEY_MISSING` | 재무제표를 받아야 하는데 OpenDART 호출이 실패함 |

### POST /api/analyses — 분석 요청

- 이슈: #14 (2.3) · 화면: W-01 ③ → W-02
- 같은 기업·보고서 쌍·비교 기준·분석 버전으로 완료된 결과가 있으면 새로 만들지 않고 그 결과를 돌려줍니다(200, `reused: true`). 진행 중인 작업이 있으면 그 작업을 돌려줍니다(202, `reused: true`). 실패한 작업은 다시 쓰지 않고 새로 만듭니다. 문장 비교가 실패(`textStatus: FAILED`)로 끝난 완료 결과도 다시 쓰지 않고 새로 분석합니다(AI 서버·OpenDART의 일시 장애였으면 원문을 다시 비교할 수 있게). 진행 중인데 30분 넘게 상태가 바뀌지 않은 작업은 멈춘 것으로 보고 실패(`ANALYSIS_TIMED_OUT`)로 바꾼 뒤 새로 만듭니다.
- 새로 만들기 전에 비교 가능성 검증(2.2)을 합니다. 통과하지 못하면 만들지 않고 422입니다.
- 저장하는 `basis`는 고른 보고서 쌍이 실제로 맞는 기준입니다. `YOY`·`PREV`인데 고른 보고서가 그 기준의 보고서가 아니면 `CUSTOM`(직접 선택)으로, 반대로 `CUSTOM`인데 전년 동기·직전 기간 쌍이면 `YOY`·`PREV`로 저장합니다. 응답의 `basis`도 저장한 값입니다. 결과 화면이 기준을 잘못 보여 주지 않고, 같은 보고서 쌍을 기준 이름만 달리해 두 번 분석하지 않기 위해서입니다.
- 분석은 요청과 다른 스레드에서 돕니다. 진행 상황은 `GET /api/analyses/{analysisId}`로 봅니다.
- 요청의 추적 ID(`X-Trace-Id`)를 분석에 저장하고, 분석이 도는 동안 로그에 같은 값을 남깁니다.
- '보고서 비교' 단계에서 재무 수치와 함께 두 보고서 원문을 구조화(4.2)해 문장·표를 비교합니다(2.5). 원문을 받지 못하거나 읽지 못해도 분석은 재무 결과로 완료하고, `textStatus`·`textMessage`에 사유를 남깁니다.

**요청 본문**: 비교 가능성 검증과 같습니다.

**응답 202 / 200**

```json
{ "analysisId": 42, "status": "PENDING", "step": "RECEIVED", "reused": false }
```

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 필수 값 없음 |
| 404 | `REPORT_NOT_FOUND` | 없는 보고서 |
| 422 | `ANALYSIS_NOT_COMPARABLE` | 비교 가능성 검증을 통과하지 못함(`message`에 첫 번째 사유) |
| 502·503 | `DART_REQUEST_FAILED`, `DART_RATE_LIMITED`, `DART_KEY_MISSING` | 검증에 필요한 재무제표를 받지 못함 |

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
  "completedAt": null,
  "textStatus": null,
  "textMessage": null,
  "summaryStatus": null,
  "summaryMessage": null
}
```

`current`·`previous`는 목록 항목과 같은 모양입니다. `steps[].state`는 `DONE`, `ACTIVE`, `PENDING`, `FAILED`입니다. 실패하면 `status`가 `FAILED`, 실패한 단계의 `state`가 `FAILED`이고 `error`에 `{ "code", "message", "retryable" }`이 들어 있습니다. 결과를 저장하기 전에는 `COMPLETED`가 되지 않습니다.

| `error.code` | 뜻 | `retryable` |
| --- | --- | --- |
| `ANALYSIS_NOT_COMPARABLE` | 실행 중 다시 확인했을 때 비교할 수 없음 | false |
| `ANALYSIS_EVIDENCE_MISMATCH` | 근거 확인 실패(값의 근거가 그 보고서가 아니거나 증감액이 두 값의 차와 다름) | true |
| `ANALYSIS_SUMMARY_FAILED` | 요약에 LLM이 필요한데 AI 서버나 LLM을 부를 수 없음(0.7). 요약 없는 결과를 완료로 보이지 않음 | true |
| `ANALYSIS_SAVE_FAILED` | 결과 저장 실패. 완료로 표시하지 않음 | true |
| `ANALYSIS_FAILED` | 알 수 없는 오류 | true |
| `ANALYSIS_BUSY` | 분석 요청이 많아 대기열에 넣지 못함 | true |
| `ANALYSIS_INTERRUPTED` | 실행 중에 서버가 다시 시작됨(서버가 뜰 때 끝나지 않은 작업을 실패로 바꿈) | true |
| `ANALYSIS_TIMED_OUT` | 30분 넘게 진행되지 않아 멈춘 것으로 봄 | true |
| `DART_REQUEST_FAILED`, `DART_RATE_LIMITED`, `DART_KEY_MISSING` | OpenDART 호출 실패 | true |

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

- 완료된 분석의 결과만, 그 분석에 저장된 결과만 돌려줍니다(다른 분석 결과와 섞지 않음).
- `statements`는 다섯 재무제표가 늘 들어 있고, 비교 규칙(2.2)과 계정 수를 담습니다. `changed`는 증감액이 0이 아니거나 계산하지 못한 계정 수입니다.
- `items`는 고른 재무제표의 계정을 원문 순서대로 돌려줍니다.

**응답 200**

```json
{
  "analysisId": 42,
  "fsDiv": "CFS",
  "sjDiv": "IS",
  "changedOnly": false,
  "statements": [
    { "sjDiv": "BS", "label": "재무상태표", "comparable": true, "amountBasis": "POINT", "note": null, "total": 58, "changed": 41 },
    { "sjDiv": "IS", "label": "손익계산서", "comparable": true, "amountBasis": "CUMULATIVE", "note": null, "total": 21, "changed": 19 }
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
      "calcMessage": null,
      "currency": "KRW"
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
| 400 | `COMMON_INVALID_INPUT` | `sjDiv`가 BS·IS·CIS·CF·SCE가 아님 |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 ID |
| 409 | `ANALYSIS_NOT_READY` | 분석이 아직 완료되지 않음 |

### GET /api/analyses/{analysisId}/financial-changes/{changeId} — 수치 근거 상세

- 이슈: #21 (3.3) · 화면: W-03 ② 계정 선택
- 완료된 분석의 그 분석 항목만 돌려줍니다. 다른 분석의 항목 번호면 404입니다.
- 계산하지 못한 항목은 `formula`·`rateFormula`가 null이고 `calcMessage`에 사유가 있습니다. 숫자를 채우지 않습니다.
- 한쪽 보고서에만 있는 계정이면 없는 쪽의 `previous` 또는 `current`가 null입니다.

**응답 200**: 목록 항목 필드에 아래를 더합니다.

```json
{
  "changeId": 901,
  "accountName": "매출액",
  "accountKey": "ifrs-full_Revenue",
  "fsDiv": "CFS",
  "currency": "KRW",
  "formula": "152,000,000,000,000 − 145,000,000,000,000 = 7,000,000,000,000",
  "rateFormula": "7,000,000,000,000 ÷ 145,000,000,000,000 × 100 = 4.83%",
  "previous": {
    "rceptNo": "20250814000987",
    "reportName": "반기보고서 (2025.06)",
    "fiscalYear": 2025,
    "periodEnd": "2025-06-30",
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
| 404 | `ANALYSIS_NOT_FOUND`, `ANALYSIS_CHANGE_NOT_FOUND` | 없는 분석·항목 |
| 409 | `ANALYSIS_NOT_READY` | 분석이 아직 완료되지 않음 |

### GET /api/analyses/{analysisId}/text-changes — 문장·표 변경 목록

- 이슈: #16 (2.5), #17 (2.6) · 화면: W-03 ③
- 완료된 분석의 그 분석 결과만 돌려줍니다.
- 기본 순서는 확인 우선순위(2.6)입니다. 점수가 높은 것부터, 같으면 문서 순서이고, 순위를 매기지 않은 항목(`UNRANKED`, 판단 유보)은 뒤에 문서 순서로 둡니다. 우선순위는 확인할 순서이며 투자 판단이 아닙니다.
- `sort=document`면 현재 보고서의 문서 순서입니다(짝이 없는 이전 보고서 항목은 이전 보고서에서 있던 자리).
- 문단·표 하나가 변경 하나입니다. 섹션이 통째로 한쪽에만 있으면 그 섹션의 블록이 모두 추가 또는 삭제입니다.
- 같은 이름의 항목 수가 두 보고서에서 달라 짝을 정하지 못한 섹션은 숨기지 않고 `REVIEW_NEEDED` 하나로 남깁니다.
- `textStatus`가 `FAILED`면 `items`가 비어 있고 `textMessage`에 사유가 있습니다. 화면은 '변경 없음'으로 보여 주지 않습니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `type` | string | 아니오 | `ADDED`, `DELETED`, `MODIFIED`, `REVIEW_NEEDED`. 없으면 전체 |
| query | `sort` | string | 아니오 | `priority`(기본) 확인 우선순위, `document` 문서 순서 |
| query | `page` | int | 아니오 | 0부터. 기본 0 |
| query | `size` | int | 아니오 | 1~100. 기본 20 |

**응답 200**

```json
{
  "analysisId": 42,
  "textStatus": "COMPLETED",
  "textMessage": null,
  "type": null,
  "sort": "priority",
  "page": 0,
  "size": 20,
  "totalItems": 57,
  "counts": { "all": 57, "added": 10, "deleted": 5, "modified": 40, "reviewNeeded": 2 },
  "items": [
    {
      "changeId": 3001,
      "changeNo": 1,
      "changeType": "MODIFIED",
      "blockType": "PARAGRAPH",
      "numbersOnly": false,
      "sectionStatus": "MATCHED",
      "sectionTitle": "1. 사업의 개요",
      "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
      "previousPreview": "…당사는 메모리 반도체를 만듭니다.",
      "currentPreview": "…당사는 메모리 반도체와 파운드리 사업을 합니다.",
      "similarity": 0.6818,
      "reviewReason": null,
      "priority": {
        "level": "HIGH",
        "score": 60,
        "reasons": ["사업의 내용 섹션 +30", "수정 +10", "크게 바뀜(비슷한 정도 0.7 미만) +10", "문단 +10"]
      }
    }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `priority.level` | `HIGH` 중요도 높음(60점 이상), `MEDIUM` 중간(30점 이상), `LOW` 낮음, `UNRANKED` 판단 유보(검토 필요 항목. 규칙으로 판단할 수 없어 순위를 매기지 않음) |
| `priority.score` | 적용한 규칙 점수의 합. `UNRANKED`면 null |
| `priority.reasons` | 적용한 규칙과 점수(잠정 규칙, 5절) |
| `totalItems` | `type`에 맞는 전체 건수(쪽 나누기 전) |
| `blockType` | `PARAGRAPH` 문단, `TABLE` 표, `SECTION` 섹션 단위 검토 필요 |
| `numbersOnly` | 수정인데 숫자만 바뀜(재무 표 등) |
| `sectionStatus` | 섹션 짝짓기 결과. `MATCHED`, `RENAMED`(제목이 조금 바뀐 섹션), `ADDED`, `DELETED`, `AMBIGUOUS` |
| `previousPreview`·`currentPreview` | 앞부분 240자. 수정이면 두 글이 처음 달라지는 곳 조금 앞부터 자르고 앞뒤에 `…`. 없는 쪽은 null |
| `similarity` | 수정일 때 두 글이 비슷한 정도(0~1) |

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `type`·`sort`·`page`·`size`가 범위 밖 |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 ID |
| 409 | `ANALYSIS_NOT_READY` | 분석이 아직 완료되지 않음 |

### GET /api/analyses/{analysisId}/text-changes/{changeId} — 문장·표 근거 상세

- 이슈: #22 (3.4) · 화면: W-03 ③ 변경 항목의 '근거 상세'
- 완료된 분석의 그 분석 항목만 돌려줍니다. 다른 분석의 항목 번호면 404입니다.
- 변경 전·후 원문 전체를 보고서·종류·대상 기간·항목(섹션 경로)·위치(블록 번호, 근거 ID)와 함께 돌려줍니다. 없는 쪽(추가의 이전, 삭제의 현재)은 null입니다.
- 글은 분석할 때 저장한 것입니다. 표 셀(`table`)은 저장된 원문 블록의 글이 분석 때와 같을 때만 붙입니다. 원문을 다시 구조화해 위치가 달라졌으면 `blockMatches: false`이고 글만 있습니다.
- 짝을 정하지 못한 항목(`REVIEW_NEEDED`)은 섹션 위치만 있고 `blockNo`·`evidenceId`가 null입니다. 화면은 근거가 있는 것처럼 보여 주지 않습니다.

**응답 200**

```json
{
  "change": { "changeId": 3001, "changeType": "MODIFIED", "...": "목록 항목과 같은 모양" },
  "previous": {
    "rceptNo": "20250814000987",
    "reportName": "반기보고서 (2025.06)",
    "reportType": "HALF",
    "fiscalYear": 2025,
    "periodEnd": "2025-06-30",
    "sectionNo": 3,
    "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
    "blockNo": 41,
    "evidenceId": "20250814000987#B41",
    "blockType": "PARAGRAPH",
    "text": "당사는 메모리 반도체를 만듭니다.",
    "table": null,
    "blockMatches": true,
    "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000987"
  },
  "current": { "rceptNo": "20260814001234", "...": "previous와 같은 모양" }
}
```

| 필드 | 설명 |
| --- | --- |
| `table` | 표 셀 `[[{"text","header","colspan","rowspan"}]]`. 문단이거나 저장된 원문과 맞지 않으면 null |
| `blockMatches` | 저장된 원문 블록의 글이 분석 때와 같은지 |

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND`, `ANALYSIS_TEXT_CHANGE_NOT_FOUND` | 없는 분석·변경 항목 |
| 409 | `ANALYSIS_NOT_READY` | 분석이 아직 완료되지 않음 |

### GET /api/analyses/{analysisId}/documents/{side} — 원문 목차

- 이슈: #23 (3.5) · 화면: W-03 ④
- `side`는 `current`(현재 보고서) 또는 `previous`(비교 보고서)입니다. 분석의 두 보고서만 보여 줍니다(근거가 화면의 보고서 쌍과 맞는지 확인).
- 원문은 분석할 때 구조화(4.2)한 것입니다. 이 API는 OpenDART를 부르지 않습니다.
- DART 원문 안의 위치로 바로 가는 주소는 만들지 않습니다(`positionLinkSupported: false`, 위치 이동 미지원). 화면은 보고서 링크와 항목 경로를 안내합니다.
- `restructuredAfterAnalysis`: 분석이 끝난 뒤 원문을 다시 구조화했으면(파서 버전이 바뀜) true입니다. 분석이 저장한 근거 위치(블록 번호)가 지금 원문과 다를 수 있어 화면이 안내합니다.

**응답 200**

```json
{
  "side": "current",
  "rceptNo": "20260814001234",
  "reportName": "반기보고서 (2026.06)",
  "documentStatus": "STRUCTURED",
  "statusMessage": null,
  "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814001234",
  "positionLinkSupported": false,
  "restructuredAfterAnalysis": false,
  "sections": [
    { "sectionNo": 2, "parentNo": null, "depth": 1, "title": "II. 사업의 내용", "cover": false, "blockCount": 0 },
    { "sectionNo": 3, "parentNo": 2, "depth": 2, "title": "1. 사업의 개요", "cover": false, "blockCount": 12 }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `documentStatus` | `STRUCTURED`, `PARTIAL`(일부 빠졌을 수 있음), `FAILED`(읽지 못함), `NOT_AVAILABLE`(OpenDART에 원문 없음), `NOT_FETCHED`(아직 받지 않음). 앞의 둘만 `sections`가 있음 |
| `statusMessage` | `STRUCTURED`가 아니면 사유 |
| `sections[].blockCount` | 그 섹션에 바로 속한 문단·표 수(하위 섹션 제외) |

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `side`가 `current`·`previous`가 아님 |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 ID |

### GET /api/analyses/{analysisId}/documents/{side}/sections/{sectionNo} — 원문 한 항목

- 이슈: #23 (3.5) · 화면: W-03 ④
- 그 섹션에 바로 속한 문단·표를 문서 순서로 돌려줍니다. 근거 위치(블록 번호)를 강조할 때 씁니다.

**응답 200**

```json
{
  "side": "current",
  "rceptNo": "20260814001234",
  "sectionNo": 3,
  "title": "1. 사업의 개요",
  "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
  "blocks": [
    { "blockNo": 44, "evidenceId": "20260814001234#B44", "type": "PARAGRAPH", "text": "당사는 …", "table": null },
    { "blockNo": 45, "evidenceId": "20260814001234#B45", "type": "TABLE", "text": "구분 | 금액", "table": [[{ "text": "구분", "header": true }]] }
  ]
}
```

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `side`가 `current`·`previous`가 아님 |
| 404 | `ANALYSIS_NOT_FOUND`, `REPORT_SECTION_NOT_FOUND` | 없는 분석, 원문에 없는 섹션(또는 원문을 쓸 수 없음) |

### GET /api/analyses/{analysisId}/summary — 근거 기반 요약·설명

- 이슈: #20 (3.2) · 화면: W-03 ①
- 요약할 변화는 코드가 고릅니다(5절 잠정 규칙). 재무 수치의 사실 문장(`factSentence`)은 코드가 계산한 값으로 만들고, LLM은 문장 변화의 요약과 공시에 적힌 설명(`aiText`)만 씁니다.
- AI 서버가 LLM 문장의 근거 ID가 보낸 원문 위치인지, 문장의 숫자가 그 원문에 있는지 확인합니다. 통과하지 못하면 2회까지 다시 만들고, 그래도 통과하지 못한 항목은 요약에서 빼고 `reviewNeeded`에 남깁니다.
- 분석이 끝나지 않았으면 `ANALYSIS_NOT_READY`(409)입니다.

**응답 200**

```json
{
  "analysisId": 42,
  "summaryStatus": "COMPLETED",
  "summaryMessage": null,
  "textStatus": "COMPLETED",
  "items": [
    {
      "itemNo": 1, "kind": "FINANCIAL",
      "target": { "type": "FINANCIAL", "changeId": 101, "sjDiv": "IS" },
      "factSentence": "매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%).",
      "aiText": "회사는 메모리 수요 회복으로 매출이 늘었다고 적었어요.",
      "aiGenerated": true,
      "explanationStatus": "FOUND",
      "evidence": [{ "evidenceId": "20260814001234#B812", "side": "current", "rceptNo": "20260814001234", "sectionNo": 41, "blockNo": 812 }],
      "ai": { "model": "fake-model", "promptVersion": "summary-1", "generatedAt": "2026-10-21T14:07:12" }
    },
    {
      "itemNo": 2, "kind": "TEXT",
      "target": { "type": "TEXT", "changeId": 5512, "sjDiv": null },
      "factSentence": null,
      "aiText": "미국에 공장 2곳을 새로 짓는다는 내용이 들어갔어요.",
      "aiGenerated": true,
      "explanationStatus": null,
      "evidence": [{ "evidenceId": "20260814001234#B44", "side": "current", "rceptNo": "20260814001234", "sectionNo": 3, "blockNo": 44 }],
      "ai": { "model": "fake-model", "promptVersion": "summary-1", "generatedAt": "2026-10-21T14:07:12" }
    }
  ],
  "reviewNeededCount": 1,
  "reviewNeeded": [
    { "itemNo": 3, "kind": "TEXT", "target": { "type": "TEXT", "changeId": 5520, "sjDiv": null }, "reason": "원문에 없는 숫자(3)를 썼어요." }
  ]
}
```

- `summaryStatus`: `COMPLETED`(모두 근거 확인), `PARTIAL`(검토 필요 항목이 있음), `EMPTY`(요약할 변화가 없음). M1에서 만든 분석에는 `null`입니다.
- `kind`: `FINANCIAL`(재무 수치. `target.changeId`는 `financial-changes`의 `changeId`), `TEXT`(문장 변화. `target.changeId`는 `text-changes`의 `changeId`).
- `explanationStatus`(재무 수치만): `FOUND`(공시에 적힌 설명이 있음), `NOT_FOUND`(확인된 설명 없음. 화면에 그렇게 표시), `REVIEW_NEEDED`(설명을 만들었지만 근거를 확인하지 못함. 사실 문장은 보이고 설명은 `reviewNeeded`에도 셈).
- `aiGenerated`가 true인 문장(`aiText`)은 화면에 'AI 생성'으로 표시하고 `ai`(모델·프롬프트 버전·생성 시각)를 함께 보여 줍니다. 사실 문장(`factSentence`)은 코드가 만든 문장이라 'AI 생성'이 아닙니다.
- `evidence[]`는 `aiText`의 근거입니다. `side`·`sectionNo`·`blockNo`로 원문 확인(④)을 엽니다. `side`가 null이면 분석의 보고서가 아닌 근거라 열지 않습니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 ID |
| 409 | `ANALYSIS_NOT_READY` | 분석이 끝나지 않음 |

### GET /api/system/health — 연결 상태

- 이슈: #48 (0.5)

**응답 200**

```json
{ "backend": "UP", "aiServer": "UP" }
```

AI 서버가 응답하지 않으면 `aiServer`가 `DOWN`입니다(200 그대로).

## 3. 내부 API (Spring Boot → FastAPI)

외부에 열지 않습니다. 요청 헤더에 항상 `X-Trace-Id`를 넣습니다. 에러 형식은 외부 API와 같습니다. AI 서버만 쓰는 에러 코드는 `AI_`로 시작합니다(아래 표).

| 메서드 | 경로 | 설명 | 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| GET | `/internal/health` | AI 서버 상태 | #48 (0.5) | 초안 |
| GET | `/health` | AI 서버 자체 상태(사람·배포 도구가 확인용으로 씀. backend는 `/internal/health`를 부름) | #44 (0.1) | 초안 |
| GET | `/internal/documents/parser` | 원문 파서 버전 | #28 (4.2) | 초안 |
| POST | `/internal/documents/{rceptNo}/structure` | 원문 ZIP 구조화 | #28 (4.2) | 초안 |
| POST | `/internal/text-changes` | 두 원문의 문장·표 변경 탐지 | #16 (2.5) | 초안 |
| POST | `/internal/summaries` | 근거 기반 요약·설명(LLM) | #20 (3.2) | 초안 |

| code | 상태 | 뜻 |
| --- | --- | --- |
| `AI_DOCUMENT_TOO_LARGE` | 413 | 원문 ZIP이 80MB를 넘음 |
| `AI_LLM_UNAVAILABLE` | 503 | LLM 제공자가 설정되지 않았거나 다시 시도해도 응답하지 않음(0.7). backend는 분석을 `ANALYSIS_SUMMARY_FAILED`로 끝냄 |

### GET /internal/documents/parser — 원문 파서 버전

```json
{ "parserVersion": "dart-xml-1" }
```

backend는 저장된 구조화 결과의 파서 버전이 이 값과 다르면 다시 구조화합니다(ERD `report_document`).

### POST /internal/documents/{rceptNo}/structure — 원문 구조화

- 이슈: #28 (4.2)
- 본문은 OpenDART `document.xml`에서 받은 ZIP 그대로입니다(`Content-Type: application/zip`).
- ZIP 안의 `{rceptNo}.xml`만 읽고, 붙은 파일(`_00760` 등 감사보고서)은 `attachments`에 이름만 남깁니다.
- 원문 XML은 형식이 엄격하지 않아 관대하게 읽습니다. 이스케이프 안 된 `&`만 고치고, 표 셀(TD·TH·TE·TU)·문단(P) 태그 수를 원문과 대조합니다. 다르면 `PARTIAL`과 경고입니다.
- 읽지 못해도 에러가 아니라 200과 `status: FAILED`, `failureCode`·`failureMessage`입니다.

**응답 200**

```json
{
  "rceptNo": "20260814001234",
  "parserVersion": "dart-xml-1",
  "status": "STRUCTURED",
  "failureCode": null,
  "failureMessage": null,
  "mainFile": "20260814001234.xml",
  "encoding": "utf-8",
  "documentName": "반기보고서",
  "companyName": "삼성전자",
  "attachments": ["20260814001234_00760.xml"],
  "warnings": [],
  "counts": { "sections": 120, "paragraphs": 2100, "tables": 640, "cells": 25010, "sourceCells": 25010 },
  "sections": [
    {
      "sectionNo": 3, "parentNo": 2, "level": 2, "title": "1. 사업의 개요", "ref": "D-0-2-1-0", "cover": false,
      "blocks": [
        { "blockNo": 41, "type": "PARAGRAPH", "text": "당사는 …" },
        { "blockNo": 42, "type": "TABLE", "text": "구분 | 금액\n매출 | 1,000",
          "rows": [[{ "text": "구분", "header": true, "colspan": 2 }], [{ "text": "매출" }, { "text": "1,000" }]] }
      ]
    }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `status` | `STRUCTURED` 끝까지 읽음, `PARTIAL` 일부 빠졌을 수 있음(경고에 사유), `FAILED` 읽지 못함 |
| `failureCode` | `INVALID_ZIP`, `MAIN_FILE_NOT_FOUND`, `FILE_TOO_LARGE`(본문 파일을 풀면 300MB 초과), `UNSUPPORTED_FORMAT`(목차를 찾지 못함), `PARSE_ERROR` |
| `warnings[].code` | `CELL_COUNT_MISMATCH`, `PARAGRAPH_COUNT_MISMATCH`, `ENCODING_REPLACED`(이 셋이면 `PARTIAL`), `UNTITLED_SECTION`, `NO_BODY_TAG` |
| `sections[].level` | `SECTION-n`의 n. 표지는 1(`cover: true`), 목차 밖 본문은 0 |
| `sections[].ref` | 원문 TITLE의 `AASSOCNOTE` 값. 없으면 null |
| `blocks[].blockNo` | 문서 전체에서 순서대로 1부터. 근거 ID `{rceptNo}#B{blockNo}`의 기준 |
| `blocks[].rows` | 표 셀. `header`(TH), `colspan`·`rowspan`은 기본값이 아니면만 들어 있음 |

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 접수번호가 14자리 숫자가 아님, 본문이 비어 있음 |
| 413 | `AI_DOCUMENT_TOO_LARGE` | ZIP이 80MB를 넘음 |

### POST /internal/text-changes — 문장·표 변경 탐지

- 이슈: #16 (2.5)
- backend가 구조화해 저장한 두 원문(목차와 블록 글)을 보냅니다. AI 서버는 위치(섹션·블록 번호)만 돌려주고, 글은 backend가 저장된 원문에서 붙입니다.
- 섹션은 제목에서 번호·공백·기호를 뺀 이름을 상위 섹션부터 이은 경로로 짝짓습니다. 같은 경로가 양쪽에 같은 수만큼 있으면 순서대로 짝짓고, 수가 다르면 `REVIEW_NEEDED`입니다. 경로가 없으면 같은 상위 섹션 안에서 제목이 비슷한(0.8 이상) 섹션을 짝짓습니다(`RENAMED`, 점수가 같으면 문서 순서). 상위 섹션 이름이 크게 바뀌어 짝이 없으면, 그 아래 섹션을 자기 제목으로 짝짓고(양쪽에 하나씩일 때) 하위 섹션이 절반 넘게 짝지어진 상위 섹션끼리도 짝짓습니다(`RENAMED`).
- 블록은 숫자를 가린 글로 자리를 맞춥니다(숫자만 바뀐 표도 같은 자리로). 맞춘 자리의 글이 다르면 `MODIFIED`, 한쪽에만 있으면 `ADDED`·`DELETED`, 맞지 않는 구간은 글이 비슷한(0.5 이상) 블록끼리 `MODIFIED`로 짝짓습니다. 비슷한 정도(`similarity`)는 짧은 글(두 글 합 800자 이하)은 글자, 긴 글은 낱말 단위로 잽니다. 구간 하나에서 비교하는 횟수에 상한(300번)이 있어 넘으면 나머지는 `ADDED`·`DELETED`로 둡니다.

**요청**

```json
{
  "previous": {
    "rceptNo": "20250814000987",
    "sections": [{ "sectionNo": 3, "parentNo": 2, "level": 2, "title": "1. 사업의 개요", "cover": false }],
    "blocks": [{ "blockNo": 41, "sectionNo": 3, "type": "PARAGRAPH", "text": "당사는 …" }]
  },
  "current": { "rceptNo": "20260814001234", "sections": [], "blocks": [] }
}
```

**응답 200**

```json
{
  "diffVersion": "text-diff-1",
  "sectionCounts": { "matched": 118, "renamed": 1, "added": 2, "deleted": 1, "ambiguous": 0 },
  "changes": [
    {
      "changeType": "MODIFIED", "blockType": "PARAGRAPH", "sectionStatus": "MATCHED",
      "sectionTitle": "1. 사업의 개요", "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
      "previous": { "sectionNo": 3, "blockNo": 41 }, "current": { "sectionNo": 3, "blockNo": 44 },
      "numbersOnly": false, "similarity": 0.6818, "reviewReason": null,
      "priority": { "level": "HIGH", "score": 60, "reasons": ["사업의 내용 섹션 +30", "수정 +10", "크게 바뀜(비슷한 정도 0.7 미만) +10", "문단 +10"] }
    }
  ]
}
```

- `priorityVersion`(응답 맨 위, 예: `priority-1`)은 우선순위 규칙 버전입니다. 각 변경의 `priority`는 확인할 순서를 정하는 점수와 적용한 규칙입니다(2.6, 5절의 잠정 규칙). `REVIEW_NEEDED`는 `UNRANKED`이고 점수가 없습니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 접수번호 형식이 틀림, 섹션 번호가 겹침, 없는 섹션을 가리키는 블록 |

### POST /internal/summaries — 근거 기반 요약·설명

- 이슈: #20 (3.2) · LLM은 `app/llm`의 한 모듈(0.7)로만 부릅니다.
- backend가 고른 항목과 그 근거 원문만 보냅니다. 사용자 정보는 넣지 않습니다. 원문은 프롬프트에서 `<disclosure id="…">` 태그로 감싸 자료로만 씁니다.
- LLM은 문장 변화마다 한 문장 요약(`sentence`)을, 재무 수치마다 후보 원문에 적힌 설명(`explanation`)을 씁니다. 후보 원문이 없는 재무 수치는 LLM에 묻지 않고 설명 없음(`explanation: null`)으로 돌려줍니다.
- 확인: 근거 ID가 그 항목에 보낸 원문 위치인지, 문장의 숫자가 인용한 원문에 있는지. 실패하면 문제를 알려 주며 2회까지 다시 만들고, 그래도 실패한 항목은 `REVIEW_NEEDED`입니다(통과한 항목은 씀).

**요청**

```json
{
  "companyName": "삼성전자",
  "previousReport": "반기보고서 (2025.06)",
  "currentReport": "반기보고서 (2026.06)",
  "textItems": [
    { "ref": "T12", "changeType": "ADDED", "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
      "sources": [{ "evidenceId": "20260814001234#B44", "sectionPath": "II. 사업의 내용 > 1. 사업의 개요", "text": "…" }] }
  ],
  "financialItems": [
    { "ref": "F3", "accountName": "매출액", "direction": "UP",
      "candidates": [{ "evidenceId": "20260814001234#B812", "sectionPath": "IV. 이사의 경영진단 및 분석의견 > 2. 영업실적", "text": "…" }] }
  ]
}
```

**응답 200**

```json
{
  "promptVersion": "summary-1",
  "model": "fake-model",
  "generatedAt": "2026-10-21T14:07:12",
  "items": [
    { "ref": "T12", "kind": "TEXT", "status": "OK", "sentence": "…", "explanation": null,
      "evidenceIds": ["20260814001234#B44"], "reviewReason": null, "blockedRules": [] },
    { "ref": "F3", "kind": "FINANCIAL", "status": "OK", "sentence": null, "explanation": "…",
      "evidenceIds": ["20260814001234#B812"], "reviewReason": null, "blockedRules": [] }
  ],
  "calls": [
    { "task": "summary", "provider": "fake", "model": "fake-model", "promptVersion": "summary-1",
      "calledAt": "2026-10-21T14:07:11", "traceId": "…", "inputTokens": 1830, "outputTokens": 210,
      "latencyMs": 1420, "attempt": 1, "outcome": "OK", "error": null }
  ]
}
```

- `status`: `OK` 또는 `REVIEW_NEEDED`(`reviewReason`에 사유). `calls`는 이 요청에서 LLM을 부른 기록(다시 만든 것 포함)이고 backend가 `llm_call`에 저장합니다.
- 시각은 한국 시간 `YYYY-MM-DDTHH:mm:ss`입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `ref`가 겹침, 필드 누락 |
| 503 | `AI_LLM_UNAVAILABLE` | LLM을 쓸 수 없음 |

## 4. 에러 코드

`code`는 `영역_내용` 형식의 대문자 스네이크입니다. 화면은 `code`를 보고 예외 상태를 고릅니다. 분석 작업이 실패한 사유(`GET /api/analyses/{analysisId}`의 `error.code`)는 HTTP 에러가 아니라서 이 표에 없고, 그 절의 표에 있습니다.

| code | 상태 | 뜻 | 화면 처리 |
| --- | --- | --- | --- |
| `COMMON_INVALID_INPUT` | 400 | 입력값이 형식에 맞지 않음 | 입력창 아래에 `errors[].reason` |
| `COMMON_NOT_FOUND` | 404 | 없는 경로 | 공통 오류 안내 |
| `COMMON_METHOD_NOT_ALLOWED` | 405 | 지원하지 않는 메서드 | 공통 오류 안내 |
| `COMMON_INTERNAL_ERROR` | 500 | 알 수 없는 서버 오류 | 공통 오류 안내와 추적 ID |
| `COMPANY_NOT_FOUND` | 404 | 없는 기업 | 검색으로 돌아가기 |
| `COMPANY_LIST_NOT_LOADED` | 503 | 기업 목록을 아직 받지 않음 | 관리자에게 기업 목록 갱신 요청 안내 |
| `REPORT_NOT_FOUND` | 404 | 없는 보고서 | 보고서 목록 다시 불러오기 |
| `REPORT_SECTION_NOT_FOUND` | 404 | 원문에 없는 항목 | 목차에서 다시 고르기 |
| `ANALYSIS_NOT_FOUND` | 404 | 없는 분석 | 처음부터 다시 |
| `ANALYSIS_NOT_COMPARABLE` | 422 | 비교할 수 없는 보고서 쌍 | W-01 ③ 사유와 다음 행동 |
| `ANALYSIS_NOT_READY` | 409 | 분석이 끝나지 않음 | W-02로 이동 |
| `ANALYSIS_CHANGE_NOT_FOUND` | 404 | 없는 계정 항목 | 목록 다시 불러오기 |
| `ANALYSIS_TEXT_CHANGE_NOT_FOUND` | 404 | 없는 문장 변경 항목 | 목록 다시 불러오기 |
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
| 비교 가능성 규칙 | 위 `POST /api/comparability-checks`의 재무제표 종류별 비교 규칙 | [비교 가능성 규칙](https://app.notion.com/p/400b6afffc6f8178b798e570fe37828b) |
| 분석 대상 기업 범위 | 12월 결산 보고서만(사업보고서 기간이 12월인 회사) | [분석 대상 기업 범위](https://app.notion.com/p/400b6afffc6f813cadd6ff8ecce0a780) |
| 요약할 변화 고르기(3.2) | 재무 수치: 계산한 계정 중 손익계산서 증감액 상위 3개, 재무상태표 2개. 문장 변화: 우선순위 높음·중간 중 점수 상위 5개(숫자만 바뀐 것·검토 필요 제외). 설명 후보: 현재 보고서 '경영진단'·'사업의 내용' 섹션 문단 중 계정 이름이 나오는 앞의 2개(문단당 1,500자까지) | [공시 변화 평가 규칙과 중립·판단 유보 도입 여부](https://app.notion.com/p/400b6afffc6f8139ae35e8183960af19) |
| 변경 항목 우선순위 규칙(2.6) | 점수 합(`priority-1`): 섹션(사업의 내용 30, 경영진단·투자자 보호·우발·소송 25, 대주주·특수관계 20, 재무에 관한 사항 10, 그 밖 5) + 추가·삭제 20, 수정 10(비슷한 정도 0.7 미만이면 +10) + 문단 10 − 숫자만 바뀜 30 + 새로 들어간 낱말의 핵심어(소송·제재·합병 등) 15씩 최대 2개. 60점 이상 높음, 30점 이상 중간. 검토 필요는 판단 유보 | [공시 변화 평가 규칙과 중립·판단 유보 도입 여부](https://app.notion.com/p/400b6afffc6f8139ae35e8183960af19) |
