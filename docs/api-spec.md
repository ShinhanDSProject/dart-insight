# API 명세

> API를 바꾸는 PR에서 이 문서도 함께 고칩니다. 경로, 에러 형식, 추적 ID, 날짜·금액 같은 공통 규칙은 노션 [개발 기준](https://app.notion.com/p/400b6afffc6f813aac54dd697afc9d8e) 6장과 `AGENTS.md`를 따릅니다.

## 문서 정보

| 항목 | 내용 |
| --- | --- |
| 상태 | 초안 (M1 범위) |
| 담당 | 백엔드·프론트 |
| 마지막 수정 | 2026-10-27 |
| 관련 문서 | ERD(`docs/erd.md`), [화면 와이어프레임](https://app.notion.com/p/c0f540f74d92496c9c20f23867afc15a), 이슈 #47 |

## 0. 공통

- 기준 주소: backend `http://localhost:8080`, ai-server `http://localhost:8000`(내부 전용)
- 요청·응답은 JSON(UTF-8), 필드는 camelCase입니다.
- 날짜는 `YYYY-MM-DD`(한국 시간), 시각은 `YYYY-MM-DDTHH:mm:ss`(한국 시간)입니다.
- 금액은 보고서 통화의 정수(대부분 원)이고, 통화는 `currency`로 함께 줍니다. 단위 변환(백만원·억원)은 화면에서 합니다.
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

요청 본문(JSON)의 값을 정해진 타입으로 읽을 수 없으면 `errors[].field`에 JSON 경로(예: `basis`, `items[1].type`)를 넣고, enum이면 `reason`에 허용 값을 적습니다(예: `{ "field": "basis", "reason": "허용 값: YOY, PREV, CUSTOM" }`). 그 밖의 타입 오류는 `"값의 형식이 맞지 않습니다."`입니다. JSON 자체가 깨졌으면 필드를 알 수 없어 `errors`는 빈 배열이고 `message`는 `"요청 본문을 읽을 수 없습니다. JSON 형식을 확인해 주세요."`입니다.

### 공통 값

| 이름 | 값 |
| --- | --- |
| `reportType` | `ANNUAL` 사업보고서, `HALF` 반기보고서, `Q1` 1분기보고서, `Q3` 3분기보고서 |
| `correction` | `ORIGINAL` 원본, `CORRECTED` 정정(보고서명 앞머리에 '정정'), `UNKNOWN` 확인 안 됨(비고 `rm`에 '정'만 있음) |
| `disclosureType` | OpenDART 공시상세유형. `A001` 사업보고서, `A002` 반기보고서, `A003` 분기보고서 |
| `financialDataStatus` | `UNKNOWN` 확인 전(아직 받아 보지 않음), `AVAILABLE` 재무 자료 있음, `NOT_AVAILABLE` 재무 자료 없음. 받아 둔 결과(4.5)로 정하고 목록 조회에서는 OpenDART를 부르지 않음. `NOT_AVAILABLE`: 2015 사업연도 이전, 연결·별도 모두 `013`, 또는 받은 자료가 다른 접수번호(정정본) 것 |
| `basis` | `YOY` 전년 동기, `PREV` 직전 기간, `CUSTOM` 직접 선택 |
| `disclosureGroup` | 공시 묶음(공시 제목 낱말 규칙, FS-48). `PERIODIC` 정기보고서, `FUNDING` 자금 조달, `OWNERSHIP` 지분 변동, `GOVERNANCE` 지배구조, `BUSINESS` 실적·영업, `OTHER` 기타. 규칙은 `backend/.../disclosure/domain/DisclosureGroupRules.java` |
| `keyItemsKind` | 핵심 수치를 보여 줄 수 있는 주요사항보고서 종류(FS-51, OpenDART 주요사항보고서 주요정보 DS005). `CAPITAL_INCREASE` 유상증자 결정(`piicDecsn`), `CONVERTIBLE_BOND` 전환사채권 발행결정(`cvbdIsDecsn`), `BOND_WITH_WARRANT` 신주인수권부사채권 발행결정(`bdwtIsDecsn`), `EXCHANGEABLE_BOND` 교환사채권 발행결정(`exbdIsDecsn`), `TREASURY_STOCK_ACQUISITION` 자기주식 취득 결정(`tsstkAqDecsn`), `TREASURY_STOCK_DISPOSAL` 자기주식 처분 결정(`tsstkDpDecsn`), `LITIGATION` 소송 등의 제기(`lwstLg`, 3.6 #341), `STOCK_ACQUISITION` 타법인 주식 및 출자증권 양수결정(`otcprStkInvscrInhDecsn`, 3.6 #341). 규칙은 `backend/.../disclosure/domain/KeyItemRules.java` |
| `disclosureSignalKind` | 확인해 볼 공시 종류(FS-55). `LARGEST_SHAREHOLDER_CHANGE` 최대주주 변경, `CAPITAL_INCREASE` 유상증자 결정, `CONVERTIBLE_BOND` 전환사채 발행 결정, `BOND_WITH_WARRANT` 신주인수권부사채 발행 결정, `LITIGATION` 소송 등 제기, `REHABILITATION_LISTING` 회생·상장 관련 공시, `AUDITOR_CHANGE` 감사인 변경, `NON_CLEAN_AUDIT_OPINION` 감사의견(적정이 아님). 규칙은 `backend/.../disclosure/domain/DisclosureSignalRules.java` |
| `status` (분석) | `PENDING` 대기, `RUNNING` 진행, `COMPLETED` 완료, `FAILED` 실패 |
| `step` (분석) | `RECEIVED` 요청 접수, `COMPARING` 보고서 비교, `VERIFYING` 근거 확인, `DONE` 완료 |
| `sjDiv` | `BS` 재무상태표, `IS` 손익계산서, `CIS` 포괄손익계산서, `CF` 현금흐름표, `SCE` 자본변동표 |
| `fsDiv` | `CFS` 연결, `OFS` 별도 |
| `corpClass` | OpenDART 법인구분(`corp_cls`). `Y` 유가증권시장, `K` 코스닥, `N` 코넥스, `E` 기타 |
| `amountBasis` | `POINT` 시점(재무상태표), `CUMULATIVE` 누적, `QUARTER` 3개월 |
| `textStatus` (분석) | 문장 비교 상태. `COMPLETED` 끝까지 비교, `PARTIAL` 원문 일부를 읽지 못했을 수 있음, `FAILED` 비교하지 못함(문장 변경이 없다는 뜻이 아님). 완료 전이면 null |
| `changeType` (문장) | `ADDED` 추가, `DELETED` 삭제(문서에서 빠짐. 사업·계약 종료로 해석하지 않음), `MODIFIED` 수정, `NUMERIC_UPDATE` 숫자만 바뀜(숫자를 가린 글이 같은 수정), `MOVED` 위치 이동(숫자를 가린 글이 같거나 매우 비슷한 글이 다른 자리로 옮겨짐. 이전·현재 위치가 둘 다 있음), `REVIEW_NEEDED` 검토 필요(두 보고서의 항목을 짝짓지 못함). 분석 버전 `m2-8`까지의 결과에는 `NUMERIC_UPDATE`·`MOVED`가 없음(숫자만 바뀐 수정은 `MODIFIED` + `numbersOnly: true`, 옮긴 글은 `DELETED`·`ADDED` 두 건) |

## 1. 엔드포인트 요약

| 메서드 | 경로 | 설명 | 이슈 | 화면 | 상태 |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/users` | 일반 회원가입 | #136 | 회원가입(신규) | 구현 |
| POST | `/api/sessions` | 일반 로그인 | 6.2 | 로그인(신규) | 구현 |
| POST | `/api/session-refreshes` | Access Token 재발급 | 6.2 | 공통 | 구현 |
| GET | `/api/sessions/current` | 현재 인증 사용자 | 6.2 | 공통 | 구현 |
| DELETE | `/api/sessions/current` | 로그아웃 | 6.2 | 공통 | 구현 |
| GET | `/oauth2/authorization/{provider}` | 소셜 로그인 시작(`google`, `kakao`, `naver`) | #225 (6.3) | 로그인 | 구현 |
| GET | `/login/oauth2/code/{provider}` | 소셜 제공자 OAuth 콜백 | #225 (6.3) | 로그인 | 구현 |
| GET | `/api/social-sessions/callback` | 소셜 인증을 서비스 세션으로 전환 | #225 (6.3) | 로그인 | 구현 |
| GET | `/api/favorite-companies` | 내 관심 기업 목록 | #36 (6.2) | W-01 ① | 초안 |
| PUT | `/api/favorite-companies/{corpCode}` | 관심 기업 추가 | #36 (6.2) | W-01 ② | 초안 |
| DELETE | `/api/favorite-companies/{corpCode}` | 관심 기업 빼기 | #36 (6.2) | W-01 ①② | 초안 |
| GET | `/api/notifications` | 내 분석 완료 알림 목록 | #38 (6.4) | 헤더 알림 | 초안 |
| PUT·DELETE | `/api/notifications/{notificationId}/read` | 알림 읽음 표시·해제 | #38 (6.4) | 헤더 알림 | 초안 |
| GET | `/api/notes` | 내 판단 노트 목록(기업별, `?corpCode=`로 한 기업) | #413 (6.5) | 판단 노트(신규) | 초안 |
| POST | `/api/notes` | 노트에 근거 담기(재무 계정 변화·문장 변경) | #413 (6.5) | W-03 ②③ | 초안 |
| PUT | `/api/notes/{itemId}/memo` | 노트 항목 메모 고치기 | #413 (6.5) | 판단 노트(신규) | 초안 |
| DELETE | `/api/notes/{itemId}` | 노트 항목 하나 지우기 | #413 (6.5) | 판단 노트(신규) | 초안 |
| GET | `/api/notes/export` | 기업 노트를 출처와 함께 Markdown으로 내보내기(`?corpCode=`) | #413 (6.5) | 판단 노트(신규) | 초안 |
| GET | `/api/companies` | 기업 검색 | #8 (1.1) | W-01 ① | 초안 |
| GET | `/api/featured-companies` | 첫 화면 대표 기업(유가증권시장 시가총액 상위 100) | #399 (1.5) | W-01 ① | 초안 |
| GET | `/api/companies/{corpCode}` | 기업 정보 | #8 (1.1) | W-01 ② | 초안 |
| GET | `/api/companies/{corpCode}/overview` | 기업 개황(대표자·법인 구분·업종·설립일·결산월 등) | #329 (1.2) | 기업 화면 개요 탭 | 초안 |
| GET | `/api/companies/{corpCode}/reports` | 기업별 정기보고서 목록 | #9 (1.2), #10 (1.3) | W-01 ② | 초안 |
| GET | `/api/companies/{corpCode}/financial-trends` | 최근 정기보고서들의 주요 재무 흐름 | #330 (1.2) | 기업 개요 탭 | 초안 |
| GET | `/api/reports/{rceptNo}` | 보고서 메타데이터 | #10 (1.3), #11 (1.4) | W-01 ② | 초안 |
| GET | `/api/companies/{corpCode}/report-pairs` | 비교 기준에 맞는 보고서 쌍 | #12 (2.1) | W-01 ② | 초안 |
| GET | `/api/companies/{corpCode}/analyses` | 이 기업의 이미 끝난 분석 목록 | #288 (1.2) | W-01 ② | 초안 |
| GET | `/api/companies/{corpCode}/key-facts` | 최신 정기보고서와 1년 전 같은 종류 보고서의 최대주주·임원·배당과 바뀐 항목 | #331 (1.2, FS-47) | 기업 개요 탭 | 초안 |
| GET | `/api/companies/{corpCode}/disclosures` | 최근 공시 타임라인(묶음 거르기) | #332 (1.2) | 기업 개요 탭 | 초안 |
| GET | `/api/companies/{corpCode}/disclosures/{rceptNo}/key-items` | 주요사항보고서 한 건의 핵심 수치(원문 값 그대로) | #363 (1.2, FS-51) | 기업 개요 탭 최근 공시 | 초안 |
| GET | `/api/companies/{corpCode}/disclosure-signals` | 최근 1년 확인해 볼 공시(종류별 건수·사실 문장·원문 링크) | #411 (1.2, FS-55) | 기업 개요 탭 | 초안 |
| GET | `/api/companies/{corpCode}/briefing` | AI 기업 브리핑(저장된 것 또는 새로 만듦) | #333 (1.2) | 기업 화면 개요 탭 | 초안 |
| POST | `/api/companies/{corpCode}/questions` | 최신 사업보고서에 근거해 묻기(AI) | #365 (1.2) | 기업 화면 개요 탭 | 초안 |
| GET | `/api/companies/{corpCode}/questions` | 최신 사업보고서에 한 질문·답 기록 | #365 (1.2) | 기업 화면 개요 탭 | 초안 |
| POST | `/api/comparability-checks` | 비교 가능성 검증 | #13 (2.2) | W-01 ③ | 초안 |
| POST | `/api/analyses` | 분석 요청 | #14 (2.3) | W-01 ③ → W-02 | 초안 |
| GET | `/api/analyses/{analysisId}` | 분석 상태·단계 | #14 (2.3) | W-02, W-03 | 초안 |
| GET | `/api/analyses/{analysisId}/financial-changes` | 재무 수치 변화 목록 | #15 (2.4), #19 (3.1) | W-03 ② | 초안 |
| GET | `/api/analyses/{analysisId}/financial-changes/{changeId}` | 수치 근거 상세 | #21 (3.3) | W-03 ② | 초안 |
| GET | `/api/analyses/{analysisId}/text-changes` | 문장·표 변경 목록(섹션 거르기·검색 #25) | #16 (2.5) | W-03 ③ | 초안 |
| GET | `/api/analyses/{analysisId}/text-changes/{changeId}` | 문장·표 근거 상세 | #22 (3.4) | W-03 ③ | 초안 |
| GET | `/api/analyses/{analysisId}/text-changes/{changeId}/history` | 문장 변경 이력(여러 기간) | #26 (3.8) | — | 초안 |
| POST | `/api/analyses/{analysisId}/text-changes/{changeId}/explanations` | 문장 변경 AI 한 줄 풀이(만들거나 저장된 것) | #227 (3.11) | W-03 ③ | 초안 |
| GET | `/api/analyses/{analysisId}/text-changes/{changeId}/related-disclosures` | 문장 변경의 관련 수시공시(보조 근거, 처음이면 계산해 저장) | #343 (3.6) | W-03 ③ | 초안 |
| GET | `/api/analyses/{analysisId}/summary` | 근거 기반 요약·설명 | #20 (3.2) | W-03 ① | 초안 |
| POST | `/api/analyses/{analysisId}/questions` | 근거로 답하는 질문(AI) | #219 (3.10) | W-03 ⑤ | 초안 |
| GET | `/api/analyses/{analysisId}/questions` | 이 분석에서 한 질문·답 기록 | #219 (3.10) | W-03 ⑤ | 초안 |
| PUT | `/api/analyses/{analysisId}/questions/{questionId}/feedback` | AI 답 평가(도움 여부·사유) | #236 (3.12) | W-03 ⑤ | 초안 |
| GET | `/api/analyses/{analysisId}/documents/{side}` | 분석 보고서 원문 목차 | #23 (3.5) | W-03 ④ | 초안 |
| GET | `/api/analyses/{analysisId}/documents/{side}/sections/{sectionNo}` | 원문 한 항목의 문단·표 | #23 (3.5) | W-03 ④ | 초안 |
| GET | `/api/system/health` | 서비스 연결 상태 | #48 (0.5) | — | 초안 |
| GET | `/api/system/ai-usage` | AI 사용 현황(질문·평가·풀이·LLM 호출 집계, 제공자·모델별 비용) | #245, #349 (0.7) | AI 사용 현황(신규) | 초안 |

## 2. 엔드포인트 상세

### POST /api/users — 일반 회원가입

> #136 일반 회원가입. 로그인·OAuth·토큰 발급은 후속 이슈에서 구현합니다.

- 인증 없이 호출합니다. 일반 회원가입만 처리하며 로그인·OAuth·토큰 발급은 후속 이슈입니다.
- 필수 입력은 이메일·비밀번호뿐입니다. 이름·닉네임·전화번호는 수집하지 않습니다.
- 화면은 `/signup`에 두고 공통 헤더에서 진입합니다. 성공 후 같은 화면에서 완료 안내와 기업 검색으로 가는 링크를 제공합니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| body | `email` | string | 예 | 앞뒤 ASCII 공백 제거 후 전체 소문자(Locale.ROOT)로 정규화. 정규화 후 최대 254자 |
| body | `password` | string | 예 | Unicode 코드 포인트 기준 10~128자. 영문 대문자와 특수문자를 각각 1개 이상 포함. trim·대소문자 변환·Unicode 정규화 없이 그대로 사용 |

- 이메일은 ASCII의 일반적인 `local@domain` 형태만 지원합니다. local은 최대 64자이며 영숫자와 ``.!#$%&'*+/=?^_`{|}~-``를 허용합니다. local 앞뒤 점·연속 점은 거부합니다.
- domain은 점으로 구분한 두 개 이상의 레이블로 구성하며, 각 레이블은 1~63자의 영숫자·하이픈이고 시작·끝 하이픈은 거부합니다. 국제화 주소는 이 이슈에서 지원하지 않습니다.
- 이메일 내부 공백·제어문자·표시 이름·따옴표 주소는 거부합니다. 점 제거와 `+tag` 제거는 하지 않습니다.
- 이메일 전체 소문자화는 서비스의 가입 ID 정책입니다. 대소문자만 다른 주소는 동일한 가입 ID로 봅니다.
- 비밀번호의 특수문자는 문자·숫자·공백이 아닌 문자를 뜻합니다. 공백만으로 구성된 값과 제어문자(U+0000~001F, U+007F~009F), 올바르지 않은 surrogate를 거부합니다. 최대 길이를 넘으면 잘라 저장하지 않고 거부합니다.
- `passwordConfirm`은 화면에서 일치 여부를 확인하는 용도이며 API로 전송하거나 저장하지 않습니다.
- 이메일 소유 확인 메일은 이번 이슈에 포함하지 않습니다. `email_verified=false`로 저장하며, 소유 확인된 주소로 취급하지 않습니다. 인증을 포함하기로 하면 구현 전에 명세·범위를 다시 정합니다.

**응답 201**

```json
{ "userId": 1, "email": "member@example.com" }
```

- `userId`는 내부 회원 식별자입니다. 이메일은 정규화한 값을 반환합니다.
- 회원과 일반 가입 정보는 한 트랜잭션에서 저장합니다. 가입 정보 저장에 실패하면 회원 저장도 롤백합니다.
- 중복 조회는 안내를 위한 것이며 동시 요청의 최종 중복 방지는 DB UNIQUE 제약이 담당합니다.
- 동일 이메일 동시 요청은 하나만 201로 성공하고 나머지는 409로 실패합니다. 관련 없는 DB 오류까지 이메일 중복으로 바꾸지 않습니다.
- 비밀번호 원문·해시·토큰·인증 쿠키는 반환하지 않습니다. 회원가입은 로그인 상태를 만들지 않습니다.

**오류**

| 상태 | code | 조건 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 필수값 누락·타입 오류·입력 규칙 위반. 필드 검증은 `errors[].field`를 `email` 또는 `password`로 반환 |
| 409 | `COMMON_EMAIL_ALREADY_EXISTS` | 정규화된 이메일이 이미 등록됨. 메시지: 이미 가입된 이메일입니다. `errors: []` |
| 500 | `COMMON_INTERNAL_ERROR` | 그 밖의 서버 오류. 내부 DB 메시지는 노출하지 않음 |

- 공통 에러 형식과 `X-Trace-Id`를 유지합니다. 요청 DTO·바인딩 실패 값·SQL 파라미터·예외 메시지에 비밀번호나 해시가 로그로 남지 않도록 처리합니다.
- 중복 이메일 안내는 #136의 요구이며 이메일 등록 여부를 알 수 있다는 특성이 있습니다.
- 프론트는 제출 중 중복 요청을 막고 입력을 잠급니다. 오류는 해당 입력 및 공통 안내에 표시하고 네트워크 실패 시 직접 재시도할 수 있게 합니다.
- 완료 상태로 바뀌거나 페이지를 떠나면 비밀번호 입력을 버립니다. 입력값은 URL·브라우저 저장소에 넣지 않습니다.

**검증 항목**

- 정상 가입 201, 정규화·길이 경계·잘못된 타입·필수값 누락 400, 이메일 중복·동시 가입 409를 API/DB 통합 테스트로 확인합니다.
- 같은 비밀번호도 다른 salt로 저장되고 `PasswordEncoder.matches`로 검증 가능하며 응답·로그에 원문/해시가 없는지 확인합니다.
- 프론트는 비밀번호 불일치·중복 제출·서버/네트워크 실패·완료 안내를 확인합니다.
- 구현 후 backend `./gradlew build`, frontend `npm test`, `npm run build`, `npm run lint`를 실행합니다.


### POST /api/sessions — 일반 로그인

- 요청: `{ "email": "member@example.com", "password": "원문 비밀번호" }`
- 성공 200: `{ "userId": 1, "accessToken": "JWT", "expiresIn": 900 }`
- Refresh Token은 응답 JSON에 넣지 않고 `HttpOnly; SameSite=Strict; Path=/api` 쿠키로 발급합니다. 운영 HTTPS에서는 `Secure`를 켭니다.
- 이메일이 없거나 비밀번호가 틀리면 모두 `AUTH_INVALID_CREDENTIALS`(401)로 응답합니다.

### POST /api/session-refreshes — 토큰 재발급

- Refresh Token 쿠키가 필요합니다. 성공하면 새 Access Token과 회전된 Refresh Token 쿠키를 반환합니다.
- 만료·변조·폐기·재사용된 토큰은 `AUTH_INVALID_REFRESH_TOKEN`(401)입니다. 폐기 토큰 재사용 시 같은 family를 폐기합니다.

### GET·DELETE /api/sessions/current — 현재 세션·로그아웃

- GET은 Bearer Access Token이 필요하며 현재 `userId`를 반환합니다. 없거나 잘못된 JWT는 `AUTH_UNAUTHORIZED`(401)입니다.
- DELETE는 Refresh Token을 폐기하고 쿠키를 만료시킵니다. 이미 없더라도 204로 끝냅니다.

### GET /oauth2/authorization/{provider} — 소셜 로그인

- `provider`는 `google`, `kakao`, `naver` 중 하나이며 Spring Security Authorization Code 흐름을 시작합니다.
- 제공자 콜백은 `/login/oauth2/code/{provider}`로 받고, Spring Security 인증 성공 후 `/api/social-sessions/callback`에서 서비스 세션으로 전환합니다. 성공 시 `(provider, providerUserId)`로 기존 연결을 찾고, 없으면 새 `app_user`와 `social_account`를 생성합니다.
- 제공자 이메일은 표시·감사용 속성일 뿐 계정 연결 키로 쓰지 않습니다. 같은 이메일의 일반 계정이나 다른 소셜 계정과 자동 통합하지 않습니다.
- 성공 시 기존 6.2 정책의 Refresh Token 쿠키를 발급하고 `${SOCIAL_LOGIN_REDIRECT_URL}?social=success`로 이동합니다. 실패·취소·필수 식별자 누락은 `?social=error`로 이동합니다.
- 제공자의 Access Token과 Refresh Token은 DB·로그·브라우저 저장소에 저장하지 않습니다.

### GET·PUT·DELETE /api/favorite-companies — 관심 기업

- 이슈: #36 (6.2) · 화면: W-01 ① 검색 화면 '관심 기업', W-01 ② 보고서 선택 화면 별 버튼
- 로그인한 사용자만 씁니다. 세 요청 모두 Bearer Access Token이 필요하고, 없거나 잘못된 JWT는 `AUTH_UNAUTHORIZED`(401)입니다. 사용자는 토큰의 `sub`로만 정해서 다른 사용자의 목록은 읽거나 바꿀 수 없습니다.
- 목록은 사용자마다 따로이고 최대 12곳입니다. 브라우저에 저장하던 예전 목록(localStorage)은 옮기지 않습니다.

**GET /api/favorite-companies**: 최근 추가 순 목록

```json
{
  "items": [
    { "corpCode": "00126380", "corpName": "삼성전자", "stockCode": "005930", "listed": true, "addedAt": "2026-10-26T10:15:00" }
  ]
}
```

- `corpCode`·`corpName`·`stockCode`·`listed`는 `GET /api/companies`의 기업 항목과 같습니다. `addedAt`은 추가한 시각입니다(한국 시간, `yyyy-MM-dd'T'HH:mm:ss`, 다른 응답의 시각과 같은 형식).
- 목록이 비었으면 `items: []`입니다.

**PUT /api/favorite-companies/{corpCode}**: 추가

- 요청 본문은 없습니다. 성공하면 200과 추가된 항목 하나(위 `items`의 항목과 같은 모양)를 돌려줍니다.
- 이미 관심 기업이면 그대로 두고 200과 기존 항목을 돌려줍니다(중복 행을 만들지 않음, `addedAt`도 바꾸지 않음).
- 12곳이 차 있으면 가장 먼저 추가한 기업을 빼고 넣습니다(브라우저 저장 때와 같은 동작).
- 없는 고유번호는 `COMPANY_NOT_FOUND`(404)입니다.

**DELETE /api/favorite-companies/{corpCode}**: 빼기

- 204로 끝납니다. 관심 기업이 아니었거나 없는 고유번호여도 204입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 401 | `AUTH_UNAUTHORIZED` | Access Token이 없거나 유효하지 않음 |
| 404 | `COMPANY_NOT_FOUND` | PUT에서 없는 고유번호 |

### GET·PUT·DELETE /api/notifications — 분석 완료 알림

- 이슈: #38 (6.4) · 화면: 와이어프레임 없음(헤더의 알림 버튼과 목록)
- 로그인한 사용자만 씁니다. Bearer Access Token이 필요하고, 없거나 잘못된 JWT는 `AUTH_UNAUTHORIZED`(401)입니다. 사용자는 토큰의 `sub`로만 정해서 다른 사용자의 알림은 읽거나 바꿀 수 없습니다.
- 알림은 서버가 만듭니다([ADR-0031](adr/0031-favorite-report-auto-analysis-notification.md)). 즐겨찾기 기업의 새 정기보고서를 찾으면(6.3) 전년 동기 보고서와 비교하는 분석을 자동으로 요청하고, 그 분석이 완료(`COMPLETED`)되어 결과가 저장된 뒤에 그 기업을 즐겨찾기한 회원마다 알림 하나를 만듭니다. 대기·진행·실패한 분석에는 만들지 않습니다.
- 같은 회원·같은 분석의 알림은 하나뿐입니다(재시도·중복 이벤트에도 다시 만들지 않음).

**GET /api/notifications**: 최근 순 목록

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `limit` | number | 아니오 | 최대 개수. 기본 20, 1 이상 50 이하 |

```json
{
  "unreadCount": 1,
  "items": [
    {
      "notificationId": 7,
      "analysisId": 42,
      "corpCode": "00126380",
      "corpName": "삼성전자",
      "basis": "YOY",
      "previous": { "rceptNo": "20251114000987", "reportName": "분기보고서 (2025.09)", "periodEnd": "2025-09-30" },
      "current": { "rceptNo": "20261114001234", "reportName": "분기보고서 (2026.09)", "periodEnd": "2026-09-30" },
      "createdAt": "2026-11-14T15:20:31",
      "readAt": null
    }
  ]
}
```

- `unreadCount`는 `limit`과 상관없이 읽지 않은 알림 전체 수입니다. 알림이 없으면 `items: []`, `unreadCount: 0`입니다.
- `createdAt`·`readAt`은 한국 시간(`yyyy-MM-dd'T'HH:mm:ss`). 읽지 않았으면 `readAt`이 null입니다.
- 화면은 `analysisId`로 결과(`/analyses/{analysisId}`)로 이동합니다.

**PUT /api/notifications/{notificationId}/read**: 읽음으로 표시. 본문 없음, 204. 이미 읽었으면 그대로(처음 읽은 시각 유지).

**DELETE /api/notifications/{notificationId}/read**: 읽지 않음으로 되돌림. 204.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `limit`이 숫자가 아니거나 1~50 밖. `errors[].field`는 `limit` |
| 401 | `AUTH_UNAUTHORIZED` | Access Token이 없거나 유효하지 않음 |
| 404 | `ANALYSIS_NOTIFICATION_NOT_FOUND` | 없는 알림이거나 다른 회원의 알림 |

### GET·POST·PUT·DELETE /api/notes — 내 판단 노트

- 이슈: #413 (6.5, FS-57) · 화면: W-03 ② 수치 근거 상세·W-03 ③ 문장 변경 카드의 '노트에 담기', 판단 노트 화면(`/notes`, 와이어프레임 없음)
- 로그인한 사용자만 씁니다. 모든 요청에 Bearer Access Token이 필요하고, 없거나 잘못된 JWT는 `AUTH_UNAUTHORIZED`(401)입니다. 사용자는 토큰의 `sub`로만 정해서 다른 사용자의 노트는 읽거나 바꾸거나 지울 수 없습니다(다른 사용자의 항목은 없는 항목과 같이 404).
- 노트는 기업별입니다. 분석 결과의 근거 하나(재무 계정 변화 또는 문장 변경)를 항목 하나로 담고, 메모를 붙입니다. 저장 방식은 [ADR-0034](adr/0034-judgment-note-storage.md)입니다.
- 항목의 `label`·`text`는 담을 때의 사본입니다. 화면이 보낸 글이 아니라 backend가 저장된 분석 결과에서 만듭니다(재무 값 문장도 코드가 저장된 계산 결과로 만듦). 나중에 분석이 다시 만들어져도 바뀌지 않습니다.
- 노트 내용(사본·메모)은 AI 서버·LLM에 보내지 않습니다.

**항목 모양** (`NoteItem`, 아래 응답에서 같이 씀)

```json
{
  "itemId": 5,
  "corpCode": "00126380",
  "kind": "FINANCIAL_CHANGE",
  "label": "손익계산서 · 매출액",
  "text": "이전 1,000,000원 → 현재 1,200,000원, 증감 +200,000원(+20.0%)",
  "changeType": null,
  "memo": "환율 효과인지 사업의 내용에서 확인",
  "source": {
    "analysisId": 42,
    "analysisVersion": "m2-13",
    "changeId": 901,
    "sjDiv": "IS",
    "rceptNo": "20261114001234",
    "sectionNo": null,
    "blockNo": null,
    "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261114001234"
  },
  "outdated": false,
  "createdAt": "2026-10-27T10:15:00",
  "updatedAt": "2026-10-27T10:15:00"
}
```

| 필드 | 설명 |
| --- | --- |
| `kind` | `FINANCIAL_CHANGE` 재무 계정 변화(`financial_change`), `TEXT_CHANGE` 문장·표 변경(`text_change`) |
| `label` | 담을 때의 이름. 재무는 `재무제표 · 계정명`(자본변동표는 `· 구성요소`를 더함), 문장은 섹션 경로 |
| `text` | 담을 때의 값·문장. 재무는 `이전 값 → 현재 값, 증감액(증감률)`(값은 보고서 통화 정수에 천 단위 쉼표, 증감률을 계산하지 않았으면 그 사유, 없는 값은 '미기재'), 문장은 현재 보고서 쪽 글(삭제면 이전 쪽 글, 검토 필요면 사유). 4,000자를 넘으면 끝을 줄여 `…`을 붙임 |
| `changeType` | 문장 변경 유형(`changeType` (문장) 공통 값). 재무는 null |
| `memo` | 사용자가 쓴 메모. 없으면 null. 1,000자 이하 |
| `source` | 원래 위치. `analysisId`·`changeId`로 결과 화면의 그 근거로 돌아가고(재무 `/analyses/{analysisId}?tab=financial&sj={sjDiv}&change={changeId}`, 문장 `?tab=text&tc={changeId}`), `rceptNo`·`dartUrl`은 근거 보고서(재무·문장 모두 현재 보고서, 삭제된 문장은 이전 보고서). `sjDiv`는 재무만, `sectionNo`·`blockNo`는 문장만(검토 필요 항목은 `blockNo` null) |
| `outdated` | 담을 때의 분석 버전(`source.analysisVersion`)이 지금 서버의 분석 버전과 다르면 true. 화면은 '분석 방식이 바뀌어 위치가 달라졌을 수 있어요'를 보이고, `label`·`text`는 그대로 보인다 |
| `createdAt`·`updatedAt` | 담은 시각·메모를 고친 시각(한국 시간, `yyyy-MM-dd'T'HH:mm:ss`) |

**GET /api/notes**: 기업별 노트 목록

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `corpCode` | string | 아니오 | 고유번호(8자리 숫자). 주면 그 기업 노트만 |

```json
{
  "companies": [
    { "corpCode": "00126380", "corpName": "삼성전자", "items": [ { "itemId": 5, "...": "위 NoteItem" } ] }
  ]
}
```

- 기업은 가장 최근에 담은 항목 순, 항목은 최근에 담은 순입니다. 담은 것이 없으면 `companies: []`입니다.

**POST /api/notes**: 항목 담기. 201과 담은 `NoteItem`

```json
{ "kind": "FINANCIAL_CHANGE", "analysisId": 42, "changeId": 901, "memo": "환율 효과인지 사업의 내용에서 확인" }
```

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `kind` | string | 예 | `FINANCIAL_CHANGE` 또는 `TEXT_CHANGE` |
| `analysisId` | number | 예 | 완료된 분석 ID |
| `changeId` | number | 예 | 그 분석의 재무 계정 변화 ID(`GET .../financial-changes`의 `changeId`) 또는 문장 변경 ID(`GET .../text-changes`의 `changeId`) |
| `memo` | string | 아니오 | 1,000자 이하. 앞뒤 공백을 지우고, 비었으면 null |

- 기업은 분석의 기업입니다. 같은 근거를 여러 번 담으면 항목이 따로 생깁니다.

**PUT /api/notes/{itemId}/memo**: 메모 고치기. 200과 고친 `NoteItem`

```json
{ "memo": "사업의 내용 2장에서 확인함" }
```

- `memo`는 1,000자 이하입니다. null이거나 비었으면 메모를 지웁니다. 담은 `label`·`text`는 바뀌지 않습니다.

**DELETE /api/notes/{itemId}**: 항목 하나 지우기. 204

**GET /api/notes/export?corpCode=**: 기업 노트 내보내기(Markdown)

- `corpCode`는 필수입니다. 200, `Content-Type: text/markdown;charset=UTF-8`, `Content-Disposition: attachment; filename="judgment-note-{corpCode}.md"`.
- 본문은 기업 이름·고유번호·내보낸 시각·출처 안내 뒤에, 항목마다 `label`, 담은 값·문장, 메모, 근거(접수번호, 재무제표 또는 섹션·문단 번호, 분석 ID), DART 원문 주소, (`outdated`면) 위치 안내를 적습니다. 담은 것이 없으면 '담은 항목이 없어요.'만 적습니다.
- 에러는 다른 API와 같은 JSON 형식입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `kind`가 없거나 허용 값이 아님, `analysisId`·`changeId`가 없거나 1보다 작음, `memo`가 1,000자 초과, `corpCode`가 8자리 숫자가 아님(내보내기는 없을 때도). `errors[].field`에 필드 이름 |
| 401 | `AUTH_UNAUTHORIZED` | Access Token이 없거나 유효하지 않음 |
| 404 | `ANALYSIS_NOT_FOUND` | POST에서 없는 분석 |
| 409 | `ANALYSIS_NOT_READY` | POST에서 완료되지 않은 분석 |
| 404 | `ANALYSIS_CHANGE_NOT_FOUND` · `ANALYSIS_TEXT_CHANGE_NOT_FOUND` | POST에서 그 분석의 계정·문장 변경이 아님 |
| 404 | `COMPANY_NOT_FOUND` | 내보내기에서 없는 고유번호 |
| 404 | `COMPANY_NOTE_NOT_FOUND` | PUT·DELETE에서 없는 항목이거나 다른 사용자의 항목 |

### GET /api/companies — 기업 검색

- 이슈: #8 (1.1) · 화면: W-01 ①
- 회사명 일부나 종목코드로 찾습니다. 상장사와 정확히 일치하는 이름을 먼저 보여 줍니다.
- 회사명은 띄어쓰기와 대소문자를 무시하고 찾습니다(`삼성 전자` → 삼성전자). 검색어와 회사명에서 공백을 모두 뺀 값을 비교합니다.
- 검색어가 공백을 빼고 한글 자음(ㄱ~ㅎ)만으로 2자 이상이면 회사명의 초성으로 찾습니다(`ㅅㅅㅈㅈ` → 삼성전자). 회사명의 한글이 아닌 글자(영문·숫자 등)는 초성에서도 그대로 남습니다(`LG전자` → `lgㅈㅈ`).
- 앞뒤 공백을 뺀 검색어가 숫자 6자리면 종목코드로 찾습니다.
- 정렬: 공백을 뺀 이름(초성 검색이면 초성)이 검색어와 정확히 같은 회사, 상장사, 짧은 이름 순서입니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `query` | string | 예 | 회사명(일부·띄어쓰기 무시), 회사명 초성 또는 종목코드. 앞뒤 공백을 뺀 2자 이상 |
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

### GET /api/featured-companies — 대표 기업

- 이슈: #399 (1.5) · 화면: W-01 ① 검색창 아래 · [ADR-0033](adr/0033-featured-companies-from-public-data-portal.md)
- 로그인 없이 씁니다. backend가 공공데이터포털 '금융위원회_주식시세정보'로 받아 저장해 둔 목록을 그대로 돌려줍니다(요청마다 외부를 부르지 않음).
- 순서는 기준일의 유가증권시장 시가총액 큰 순입니다. 우리 기업 목록과 하나로 이어지는 종목만 담고(우선주, 같은 종목코드의 기업이 여럿인 종목은 빠짐), `rank`는 이어진 종목 안에서 1부터 다시 매깁니다. **시가총액·주가 숫자는 응답에 넣지 않습니다.**
- 화면은 `source`와 `baseDate`를 함께 보입니다(공공누리 제4유형 출처표시).

**응답 200**

```json
{
  "baseDate": "2026-10-24",
  "source": "금융위원회, 공공데이터포털",
  "items": [
    { "rank": 1, "corpCode": "00126380", "corpName": "삼성전자", "stockCode": "005930" }
  ]
}
```

- 아직 받지 못했으면 `baseDate: null`, `items: []`입니다(에러가 아님). 화면은 안내를 보이고 검색은 그대로 둡니다.
- `corpName`·`stockCode`는 우리 `company`의 값입니다.

### GET /api/companies/{corpCode} — 기업 정보

**응답 200**: 검색 결과 항목과 같은 모양입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |

### GET /api/companies/{corpCode}/overview — 기업 개황

- 이슈: #329 (1.2, FS-45) · 화면: 기업 화면 '기업 개요' 탭(`?view=overview`)
- OpenDART 기업개황(`company.json`)의 값을 그대로 돌려줍니다. 계산하거나 고친 값이 없습니다(앞뒤 공백만 지우고, 빈 문자열은 null).
- 저장 기준([ADR-0024](adr/0024-company-info-cache.md)): 받은 지 7일(`app.company.overview-refresh-after`)이 지나지 않았으면 OpenDART를 부르지 않고 저장된 값을 줍니다. 지났으면 다시 받고, 다시 받다 실패하면 저장된 값을 돌려주며 `refreshError`에 실패 이유를 담습니다.
- OpenDART가 `013`(자료 없음)이면 에러가 아니라 `available: false`이고 개황 필드는 모두 null입니다.

**응답 200**

```json
{
  "corpCode": "00126380",
  "available": true,
  "corpName": "삼성전자(주)",
  "corpNameEng": "SAMSUNG ELECTRONICS CO,.LTD",
  "stockName": "삼성전자",
  "stockCode": "005930",
  "ceoName": "전영현, 노태문",
  "corpClass": "Y",
  "indutyCode": "264",
  "establishedDate": "1969-01-13",
  "accountingMonth": 12,
  "homepageUrl": "www.samsung.com/sec",
  "irUrl": null,
  "address": "경기도 수원시 영통구  삼성로 129 (매탄동)",
  "phoneNumber": "02-2255-0114",
  "fetchedAt": "2026-10-26T10:15:30",
  "refreshError": null
}
```

| 필드 | OpenDART | 설명 |
| --- | --- | --- |
| `available` | `status` | `000`이면 true, `013`(자료 없음)이면 false |
| `corpName` | `corp_name` | 정식명칭 |
| `corpNameEng` | `corp_name_eng` | 영문명칭 |
| `stockName` | `stock_name` | 종목명(상장사) 또는 약식명칭(기타법인) |
| `stockCode` | `stock_code` | 종목코드 6자리. 비상장사는 null |
| `ceoName` | `ceo_nm` | 대표자명. 여럿이면 원문 그대로(예: 쉼표로 구분) |
| `corpClass` | `corp_cls` | 법인구분(공통 값 `corpClass`) |
| `indutyCode` | `induty_code` | 업종코드 원문 |
| `establishedDate` | `est_dt` | 설립일 `YYYY-MM-DD`. 원문이 날짜가 아니면 null |
| `accountingMonth` | `acc_mt` | 결산월(1~12). 원문이 월이 아니면 null |
| `homepageUrl` | `hm_url` | 홈페이지 원문. `http(s)://`가 없을 수 있음 |
| `irUrl` | `ir_url` | IR 홈페이지 원문 |
| `address` | `adres` | 주소 |
| `phoneNumber` | `phn_no` | 전화번호 |
| `fetchedAt` | — | OpenDART에서 받은 시각(한국 시간) |
| `refreshError` | — | 다시 받지 못해 저장된 값을 돌려줄 때 그 에러 코드. 아니면 null |

`company.json`의 법인등록번호(`jurir_no`)·사업자등록번호(`bizr_no`)·팩스번호(`fax_no`)는 저장하지도 돌려주지도 않습니다(투자자에게 쓸모가 적음).

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `COMPANY_NOT_FOUND` | 기업 목록(`company`)에 없는 고유번호. OpenDART를 부르지 않음 |
| 502 | `DART_REQUEST_FAILED` | OpenDART 호출 실패이고 저장된 개황도 없음 |
| 503 | `DART_RATE_LIMITED` | OpenDART 호출 한도 초과(020)이고 저장된 개황도 없음 |
| 503 | `DART_KEY_MISSING` | 서버에 OpenDART 키가 설정되지 않았고 저장된 개황도 없음 |

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

### GET /api/companies/{corpCode}/financial-trends — 주요 재무 흐름

- 이슈: #330 (1.2), FS-46 · 화면: 기업 화면 '기업 개요' 탭
- 정기보고서 목록(위 `GET /api/companies/{corpCode}/reports`와 같은 목록, 같은 다시 받기 규칙)에서 대상 기간이 최근인 보고서를 `limit`개까지 골라, 보고서마다 OpenDART 단일회사 주요계정(`fnlttSinglAcnt.json`)의 값을 돌려줍니다.
- 주요계정은 보고서(접수번호)마다 한 번 받아 저장하고 다시 받지 않습니다([ADR-0024](adr/0024-company-info-cache.md), ERD `report_key_account`). 아직 받지 않은 보고서만 이 요청에서 OpenDART를 부릅니다. `013`(자료 없음)도 저장하고 빈 값으로 보여 줍니다.
- 보고서 하나를 받지 못해도(호출 실패·한도 초과) 응답은 200이고, 그 기간의 `dataStatus`가 `FETCH_FAILED`입니다. 다음 요청에서 다시 받습니다. 한도 초과(020)가 나면 그 요청에서는 남은 보고서를 부르지 않습니다.
- `periods`는 대상 기간 끝(`periodEnd`)이 최근인 순서입니다. 같은 종류 보고서끼리(예: 반기끼리) 비교하는 것은 화면이 `reportType`으로 고릅니다.
- `accounts`는 늘 같은 14개 계정이 같은 순서로 들어 있고(재무상태표 9개, 손익 5개), `values`는 `periods`와 같은 순서·같은 길이입니다. 값이 없으면 null이고 0과 구분합니다.
- 금액 기준(`amountBasis`): 재무상태표는 `POINT`(기말 잔액). 손익의 `amount`는 `CUMULATIVE`(사업연도 시작부터 누적: 분·반기는 OpenDART 당기누적금액 `thstrm_add_amount`, 사업보고서와 1분기는 당기금액 `thstrm_amount`가 곧 누적), `quarterAmount`는 분·반기의 3개월 금액(당기금액 `thstrm_amount`)이고 사업보고서는 null입니다(OpenDART가 4분기 3개월 값을 주지 않음).
- OpenDART는 사업연도·보고서 코드마다 최신 공시 하나의 값만 줍니다. 받은 값의 접수번호가 보고서와 다르면(뒤에 정정 공시가 나옴) `sourceRceptNo`가 그 접수번호이고, 값의 근거는 `sourceRceptNo`입니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `fsDiv` | string | 아니오 | `CFS` 연결(기본), `OFS` 별도 |
| query | `limit` | integer | 아니오 | 보고서 수. 1~20, 기본 8 |

**응답 200**

```json
{
  "corpCode": "00126380",
  "fsDiv": "CFS",
  "refreshError": null,
  "periods": [
    {
      "rceptNo": "20260814003699",
      "reportType": "HALF",
      "reportName": "반기보고서 (2026.06)",
      "fiscalYear": 2026,
      "periodEnd": "2026-06-30",
      "dataStatus": "AVAILABLE",
      "sourceRceptNo": "20260814003699",
      "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814003699"
    }
  ],
  "accounts": [
    {
      "key": "REVENUE",
      "name": "매출액",
      "sjDiv": "IS",
      "amountBasis": "CUMULATIVE",
      "values": [
        { "rceptNo": "20260814003699", "amount": 305372914000000, "quarterAmount": 171499470000000, "currency": "KRW" }
      ]
    },
    {
      "key": "TOTAL_ASSETS",
      "name": "자산총계",
      "sjDiv": "BS",
      "amountBasis": "POINT",
      "values": [
        { "rceptNo": "20260814003699", "amount": 759480516000000, "quarterAmount": null, "currency": "KRW" }
      ]
    }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `refreshError` | 보고서 목록을 다시 받다 실패해 저장된 목록을 쓸 때 그 이유(`DART_REQUEST_FAILED` 등). 아니면 null |
| `periods[].dataStatus` | `AVAILABLE` 이 기준(`fsDiv`)의 값이 있음, `NOT_AVAILABLE` 없음(2015 사업연도 이전, `013`, 또는 응답에 이 기준이 없음 — 예: 연결재무제표를 내지 않는 회사의 `CFS`), `FETCH_FAILED` 이번 요청에서 받지 못함(다음 요청에서 다시 받음) |
| `periods[].sourceRceptNo` | 값을 받은 공시의 접수번호(OpenDART 응답의 `rcept_no`). 값이 없으면 null |
| `accounts[].key` | `CURRENT_ASSETS` 유동자산, `NON_CURRENT_ASSETS` 비유동자산, `TOTAL_ASSETS` 자산총계, `CURRENT_LIABILITIES` 유동부채, `NON_CURRENT_LIABILITIES` 비유동부채, `TOTAL_LIABILITIES` 부채총계, `CAPITAL_STOCK` 자본금, `RETAINED_EARNINGS` 이익잉여금, `TOTAL_EQUITY` 자본총계, `REVENUE` 매출액, `OPERATING_INCOME` 영업이익, `PROFIT_BEFORE_TAX` 법인세차감전 순이익, `NET_INCOME` 당기순이익, `COMPREHENSIVE_INCOME` 총포괄손익. OpenDART 계정명에서 공백과 끝의 `(손실)`을 뺀 이름으로 고름(예: `영업이익(손실)` → `OPERATING_INCOME`). 금융회사처럼 이 계정이 없는 회사는 값이 null |
| `accounts[].sjDiv` | `BS` 재무상태표, `IS` 손익(주요계정 API의 구분) |
| `values[].amount` | 재무상태표는 기말 잔액, 손익은 누적 금액. 없으면 null |
| `values[].quarterAmount` | 분·반기 손익의 3개월 금액. 재무상태표·사업보고서·값 없음이면 null |

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `fsDiv`가 `CFS`·`OFS`가 아니거나 `limit`이 1~20이 아님 |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |
| 502·503 | `DART_REQUEST_FAILED`, `DART_RATE_LIMITED`, `DART_KEY_MISSING` | 정기보고서 목록을 다시 받아야 하는데 실패하고 저장된 목록도 없음(목록 API와 같음). 주요계정을 받지 못한 것은 에러가 아니라 `FETCH_FAILED` |

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

### GET /api/companies/{corpCode}/key-facts — 최대주주·임원·배당 변화

- 이슈: #331 (1.2) · 기획서: FS-47 · 화면: 기업 화면 '기업 개요' 탭
- 현재 보고서(`current`)는 이 기업의 가장 최근 정기보고서, 이전 보고서(`previous`)는 같은 종류의 1년 전 보고서입니다(`report-pairs`의 `YOY`와 같은 규칙). 맞는 보고서가 목록에 없으면 다른 보고서로 대신하지 않고 `previous`가 null, `previousReason`에 이유가 들어 있습니다.
- 세 묶음은 OpenDART 정기보고서 주요정보에서 받습니다. 모두 `corp_code`·`bsns_year`(보고서의 `fiscalYear`)·`reprt_code`(보고서 종류)로 부릅니다.

  | 묶음 | OpenDART API | 가이드 |
  | --- | --- | --- |
  | `majorShareholders` | 최대주주 현황 `hyslrSttus.json` | [DS002 2019007](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2019007) |
  | `executives` | 임원 현황 `exctvSttus.json` | [DS002 2019010](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2019010) |
  | `dividends` | 배당에 관한 사항 `alotMatter.json` | [DS002 2019005](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2019005) |

- 받은 결과는 접수번호·묶음마다 저장하고 다시 받지 않습니다(`report_key_fact`, [ADR-0024](adr/0024-company-info-cache.md)). `013`(자료 없음)은 에러가 아니라 `NO_DATA`입니다.
- OpenDART는 사업연도·보고서 코드마다 최신 공시 하나의 값만 줍니다(`financial-trends`와 같음). 응답 행의 `rcept_no`가 보고서 접수번호와 달라도(뒤에 정정 공시가 나왔거나 목록이 아직 정정 전 것) 같은 기간의 자료면 받고, 그 접수번호를 묶음의 `sourceRceptNo`로 줍니다. 이때 값의 근거는 `sourceRceptNo`입니다. 같은 기간인지는 결산기준일(`stlm_dt`)로 봅니다. `stlm_dt`가 보고서의 대상 기간 끝(`periodEnd`)과 다르면 다른 기간의 자료라 쓰지 않고 `NO_DATA`입니다(`stlm_dt`가 없으면 요청한 사업연도·보고서 코드의 응답이므로 받음). 응답에 이 보고서 접수번호의 행이 있으면 그 행만, 없으면 첫 행의 접수번호와 같은 행만 씁니다. `rcept_no`가 없는 행은 근거가 없어 쓰지 않습니다. 한 묶음을 받다 실패해도(한도 초과·네트워크 오류) 응답 전체를 실패시키지 않고 그 묶음만 `UNAVAILABLE`로 둡니다.
- 값은 원문 표기 그대로의 문자열입니다(주식 수 `"97,414,196"`, 지분율 `"1.67"`(% 값), 배당 `"1,668"`). 이 API는 새 수치를 계산하지 않으므로 공통 규칙의 정수 금액·소수 비율로 바꾸지 않습니다. 원문의 `-`·빈 값은 null입니다. 단위는 배당 `category`(원문 `se`, 예 `주당 현금배당금(원)`, `현금배당금총액(백만원)`)에 적힌 그대로입니다. 이름의 줄바꿈·연속 공백은 공백 하나로 바꿉니다.
- `changes`는 backend가 두 보고서의 같은 행을 짝지어 만든 바뀐 항목입니다. 두 묶음이 모두 `AVAILABLE`일 때만 만들고, 아니면 빈 배열입니다. 값은 양쪽 원문을 그대로 옮기고 차이를 계산하지 않습니다(문장은 화면이 만듦).

  | 묶음 | 짝짓는 기준 | 만드는 변경 |
  | --- | --- | --- |
  | `majorShareholders` | `name` + `stockKind` | `ADDED`·`REMOVED`(`field`: `endRatio`), `CHANGED`: 기말 지분율(`endRatio`)이 다르면 그 값, 같고 기말 주식 수(`endShares`)만 다르면 그 값 |
  | `executives` | `name`(같은 이름이 둘 이상이면 처음 것) | `ADDED`·`REMOVED`(`field`: `position`), `CHANGED`: 직위(`position`)·등기 구분(`registeredType`)이 다르면 필드마다 한 건 |
  | `dividends` | `category` + `stockKind` | `CHANGED`: `category`가 `주당 현금배당금`으로 시작하는 행의 당기 값(`currentTerm`)이 다를 때 |

**응답 200**

```json
{
  "corpCode": "00126380",
  "current": {
    "rceptNo": "20260814003699",
    "reportName": "반기보고서 (2026.06)",
    "reportType": "HALF",
    "fiscalYear": 2026,
    "periodEnd": "2026-06-30",
    "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814003699"
  },
  "previous": {
    "rceptNo": "20250814003156",
    "reportName": "반기보고서 (2025.06)",
    "reportType": "HALF",
    "fiscalYear": 2025,
    "periodEnd": "2025-06-30",
    "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814003156"
  },
  "previousReason": null,
  "majorShareholders": {
    "current": {
      "rceptNo": "20260814003699",
      "sourceRceptNo": null,
      "status": "AVAILABLE",
      "settlementDate": "2026-06-30",
      "rows": [
        {
          "name": "이재용",
          "relation": "최대주주의 특수관계인",
          "stockKind": "보통주",
          "beginShares": "97,414,196",
          "beginRatio": "1.65",
          "endShares": "97,414,196",
          "endRatio": "1.67",
          "remark": null
        }
      ]
    },
    "previous": { "rceptNo": "20250814003156", "sourceRceptNo": null, "status": "AVAILABLE", "settlementDate": "2025-06-30", "rows": [] },
    "changes": [
      { "type": "CHANGED", "name": "이재용", "stockKind": "보통주", "field": "endRatio", "before": "1.65", "after": "1.67" }
    ]
  },
  "executives": {
    "current": {
      "rceptNo": "20260814003699",
      "sourceRceptNo": null,
      "status": "AVAILABLE",
      "settlementDate": "2026-06-30",
      "rows": [
        {
          "name": "김용관",
          "position": "사장",
          "registeredType": "사내이사",
          "fullTime": "상근",
          "duty": "ㆍDS부문 경영전략총괄",
          "largestShareholderRelation": "계열회사 임원",
          "tenure": "4개월",
          "termEnd": "2029년 03월 17일"
        }
      ]
    },
    "previous": { "rceptNo": "20250814003156", "sourceRceptNo": null, "status": "AVAILABLE", "settlementDate": "2025-06-30", "rows": [] },
    "changes": [
      { "type": "ADDED", "name": "김용관", "stockKind": null, "field": "position", "before": null, "after": "사장" },
      { "type": "REMOVED", "name": "송재혁", "stockKind": null, "field": "position", "before": "사장", "after": null },
      { "type": "CHANGED", "name": "신제윤", "stockKind": null, "field": "registeredType", "before": "사외이사", "after": "독립이사" }
    ]
  },
  "dividends": {
    "current": {
      "rceptNo": "20260814003699",
      "sourceRceptNo": null,
      "status": "AVAILABLE",
      "settlementDate": "2026-06-30",
      "rows": [
        { "category": "주당 현금배당금(원)", "stockKind": "보통주", "currentTerm": "746", "priorTerm": "1,668", "twoTermsAgo": "1,446" }
      ]
    },
    "previous": { "rceptNo": "20250814003156", "sourceRceptNo": null, "status": "AVAILABLE", "settlementDate": "2025-06-30", "rows": [] },
    "changes": [
      { "type": "CHANGED", "name": "주당 현금배당금(원)", "stockKind": "보통주", "field": "currentTerm", "before": "732", "after": "746" }
    ]
  }
}
```

(예시는 삼성전자 실제 응답에서 일부 행만 적었습니다. 위 `previous.rows`는 줄여 적은 것입니다.)

| 필드 | 설명 |
| --- | --- |
| `current`, `previous` | 보고서. `current`는 정기보고서가 하나도 없을 때만 null(`previousReason.code`가 `NO_REPORTS`) |
| `previousReason` | `previous`가 null인 이유 `{code, message}`. `code`는 `report-pairs`의 `reason.code`와 같음(`NO_BASE_REPORT`, `NO_REPORTS`). 있으면 null |
| 묶음`.current`, 묶음`.previous` | 그 보고서의 묶음 결과. 보고서가 없으면 null |
| `sourceRceptNo` | 값을 받은 공시의 접수번호(OpenDART 응답의 `rcept_no`)가 묶음의 `rceptNo`와 다를 때 그 접수번호(정정 공시 값). 같거나 `AVAILABLE`이 아니면 null |
| `status` | `AVAILABLE` 자료 있음, `NO_DATA` 공시된 자료 없음(013, 2015 사업연도 이전, 또는 응답이 다른 기간(`stlm_dt`)의 자료), `UNAVAILABLE` 이번에 받지 못함(OpenDART 호출 실패. 저장하지 않아 다음 조회 때 다시 받음) |
| `settlementDate` | 결산기준일(`stlm_dt`). `AVAILABLE`이 아니면 null |
| `rows` | 원문 순서의 행. `AVAILABLE`이 아니면 빈 배열 |
| 최대주주 행 | `name` 성명(`nm`, 합계 행은 원문 그대로 `계`), `relation` 관계(`relate`), `stockKind` 주식 종류(`stock_knd`), `beginShares`·`beginRatio` 기초 소유 주식 수·지분율(`bsis_posesn_stock_co`·`bsis_posesn_stock_qota_rt`), `endShares`·`endRatio` 기말 소유 주식 수·지분율(`trmend_posesn_stock_co`·`trmend_posesn_stock_qota_rt`), `remark` 비고(`rm`) |
| 임원 행 | `name` 성명(`nm`), `position` 직위(`ofcps`), `registeredType` 등기 임원 여부(`rgist_exctv_at`), `fullTime` 상근 여부(`fte_at`), `duty` 담당 업무(`chrg_job`), `largestShareholderRelation` 최대주주와의 관계(`mxmm_shrholdr_relate`), `tenure` 재직 기간(`hffc_pd`), `termEnd` 임기 만료일(`tenure_end_on`). 성별·출생 연월·주요 경력은 이 화면에 쓰지 않아 내보내지 않음 |
| 배당 행 | `category` 구분(`se`), `stockKind` 주식 종류(`stock_knd`, 구분 없음은 null), `currentTerm` 당기(`thstrm`), `priorTerm` 전기(`frmtrm`), `twoTermsAgo` 전전기(`lwfr`). 한 보고서 안의 당기·전기·전전기 값은 원문 그대로 두 보고서를 비교한 것이 아님 |
| `changes[]` | `type`(`ADDED` 현재 보고서에만 있음, `REMOVED` 이전 보고서에만 있음, `CHANGED` 값이 다름), `name`(배당은 `category`), `stockKind`(임원은 null), `field` 비교한 필드 이름, `before` 이전 보고서 값, `after` 현재 보고서 값(없으면 null) |

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |
| 502·503 | `DART_REQUEST_FAILED`, `DART_RATE_LIMITED`, `DART_KEY_MISSING` | 정기보고서 목록을 다시 받아야 하는데(4.1) OpenDART 호출이 실패하고 저장된 목록도 없음. 묶음을 받다 실패한 것은 에러가 아니라 그 묶음의 `UNAVAILABLE` |

### GET /api/companies/{corpCode}/analyses — 이미 분석한 비교

- 이슈: #288 (1.2) · 화면: W-01 ②(보고서 고르기 위 '이미 분석한 비교')
- 이 기업의 완료된(`COMPLETED`) 분석만 돌려줍니다. 대기·진행·실패한 분석은 넣지 않습니다.
- 완료 시각(`completedAt`)이 최근인 순서입니다.
- 같은 보고서 쌍(`previous`·`current` 접수번호)과 같은 비교 기준(`basis`)으로 여러 번 완료됐으면(분석 버전이 바뀌어 다시 분석한 경우 등) 가장 최근에 완료된 하나만 넣습니다.
- 저장된 분석과 보고서만 읽습니다. OpenDART를 부르지 않습니다.
- 분석이 없으면 `items`가 빈 배열입니다(에러 아님).

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| path | `corpCode` | string | 예 | 고유번호 |
| query | `limit` | number | 아니오 | 최대 개수. 기본 5, 1 이상 20 이하 |

**응답 200**

```json
{
  "items": [
    {
      "analysisId": 15,
      "basis": "YOY",
      "previous": { "rceptNo": "20250814000987", "reportName": "반기보고서 (2025.06)", "periodEnd": "2025-06-30" },
      "current": { "rceptNo": "20260814001234", "reportName": "반기보고서 (2026.06)", "periodEnd": "2026-06-30" },
      "completedAt": "2026-10-24T15:20:31"
    }
  ]
}
```

`previous`·`current`의 `reportName`·`periodEnd`는 저장된 보고서(`GET /api/reports/{rceptNo}`와 같은 값)에서 읽습니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `limit`가 숫자가 아니거나 1~20 밖. `errors[].field`는 `limit` |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호(`GET /api/companies/{corpCode}`와 같음) |

### GET /api/companies/{corpCode}/disclosures — 최근 공시 타임라인

- 이슈: #332 (1.2) · 기획서: FS-48 · 화면: 기업 화면 '기업 개요' 탭의 최근 공시 영역
- 최근 `days`일(오늘 − `days`일 ~ 오늘, 한국 시간, 접수일 기준)에 이 기업이 낸 모든 종류의 공시입니다. OpenDART 공시검색(`list.json`)을 공시유형 없이, 최종보고서만(`last_reprt_at=Y`) 받습니다. 정정 공시가 나와 대체된 이전 공시는 들어 있지 않습니다(DART 공시 목록의 '최종보고서' 보기와 같음).
- 캐시([ADR-0024](adr/0024-company-info-cache.md)): 받은 목록은 기업별로 저장하고 받은 시각(`fetchedAt`)을 둡니다. 받은 지 1시간(`app.disclosures.refresh-after`)이 안 됐고 받아 둔 기간이 요청 기간을 덮으면 OpenDART를 부르지 않습니다. 다시 받다 실패하면 저장된 목록을 돌려주고 `refreshError`에 이유를 담습니다(저장된 목록도 없으면 에러). `013`(자료 없음)은 빈 목록입니다.
- 접수일(`receivedDate`)이 최근인 순서, 같은 날이면 접수번호가 큰 순서입니다.
- 묶음(`group`)은 공시 제목 낱말 규칙으로 backend가 정합니다(LLM을 쓰지 않음). 제목 앞머리의 `[기재정정]` 같은 꼬리표와 제목 뒤 덧붙인 설명(공백 여러 칸 뒤 괄호)은 떼고 봅니다. 규칙 순서는 정기보고서 → 지분 변동 → 자금 조달 → 지배구조 → 실적·영업이고, 맞는 규칙이 없으면 기타입니다.
- `periodic`: 이 서비스의 정기보고서 목록(`GET /api/companies/{corpCode}/reports`)에 들어가는 보고서(12월 결산 회사의 사업·반기·분기보고서)인지입니다. `true`면 화면이 '이 보고서로 비교하기'를 보여 줍니다.
- `groups`는 `group` 거르기와 관계없이 기간 안의 모든 공시를 묶음별로 센 값이고, 6개 묶음을 위 순서로 항상 다 넣습니다(0건 포함).
- 공시가 없으면 `items`가 빈 배열입니다(에러 아님).
- 아래 예시의 묶음별 건수는 삼성전자(`00126380`) 2026-07-28~2026-10-26 실제 응답(89건)을 규칙으로 나눈 값입니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| path | `corpCode` | string | 예 | 고유번호 |
| query | `days` | number | 아니오 | 최근 며칠. 기본 90, 1 이상 365 이하 |
| query | `group` | string | 아니오 | `disclosureGroup` 값 하나. 없으면 모든 묶음 |

**응답 200**

```json
{
  "corpCode": "00126380",
  "days": 90,
  "from": "2026-07-28",
  "to": "2026-10-26",
  "fetchedAt": "2026-10-26T14:05:12",
  "refreshError": null,
  "groups": [
    { "group": "PERIODIC", "label": "정기보고서", "count": 1 },
    { "group": "OWNERSHIP", "label": "지분 변동", "count": 71 },
    { "group": "FUNDING", "label": "자금 조달", "count": 0 },
    { "group": "GOVERNANCE", "label": "지배구조", "count": 0 },
    { "group": "BUSINESS", "label": "실적·영업", "count": 4 },
    { "group": "OTHER", "label": "기타", "count": 13 }
  ],
  "items": [
    {
      "rceptNo": "20260814001234",
      "reportName": "반기보고서 (2026.06)",
      "filerName": "삼성전자",
      "receivedDate": "2026-08-14",
      "group": "PERIODIC",
      "groupLabel": "정기보고서",
      "periodic": true,
      "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814001234",
      "remarks": null,
      "keyItemsKind": null
    }
  ]
}
```

- `keyItemsKind`: 이 공시의 핵심 수치(`GET .../disclosures/{rceptNo}/key-items`)를 받을 수 있으면 그 종류(공통 값 `keyItemsKind`), 아니면 null입니다. 제목 규칙으로 정하고 OpenDART를 부르지 않습니다(아래 key-items 절의 '종류 정하기'). 화면은 null이 아닐 때만 '핵심 수치' 버튼을 둡니다.
- `reportName`: OpenDART 보고서명(`report_nm`)의 앞뒤 공백을 빼고 이어진 공백을 한 칸으로 줄인 값입니다. `[기재정정]` 같은 꼬리표는 그대로 둡니다.
- `filerName`: 제출인(`flr_nm`). 지분 공시는 회사가 아닌 사람·법인일 수 있습니다. 없으면 null.
- `remarks`: 비고(`rm`) 원문(`유` 유가증권시장, `코` 코스닥, `채` 채권상장법인, `넥` 코넥스, `공` 공정위, `연` 연결 포함, `정` 뒤에 정정 있음, `철` 철회). 없으면 null.
- `from`·`to`: 이번 응답이 다룬 접수일 기간입니다. `refreshError`가 있고 저장된 목록이 요청 기간을 다 덮지 못하면 저장된 기간만 들어 있을 수 있습니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `days`가 숫자가 아니거나 1~365 밖(`errors[].field`는 `days`), `group`이 정해진 값이 아님(`errors[].field`는 `group`) |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |
| 502 | `DART_REQUEST_FAILED` | OpenDART 호출 실패이고 저장된 목록도 없음 |
| 503 | `DART_RATE_LIMITED` | OpenDART 호출 한도 초과(020)이고 저장된 목록도 없음 |
| 503 | `DART_KEY_MISSING` | 서버에 OpenDART 키가 설정되지 않았고 저장된 목록도 없음 |

### GET /api/companies/{corpCode}/disclosures/{rceptNo}/key-items — 주요사항보고서 핵심 수치

- 이슈: #363 (1.2) · 기획서: FS-51 · 화면: 기업 화면 '기업 개요' 탭의 최근 공시에서 '핵심 수치' 펼침
- 최근 공시 타임라인의 주요사항보고서 한 건에 대해 OpenDART '주요사항보고서 주요정보'(DS005) API가 주는 핵심 항목을 원문 값 그대로 돌려줍니다. 값을 새로 계산하거나 단위를 바꾸지 않습니다(쉼표·날짜 표기도 원문 그대로).
- 대상 공시: 이 기업의 저장된 최근 공시 목록(`GET /api/companies/{corpCode}/disclosures`가 받아 둔 것)에 있는 접수번호이고, 종류(`keyItemsKind`)가 정해지는 공시만입니다. 이 API는 공시 목록을 OpenDART에서 새로 받지 않습니다.
- **종류 정하기**(`KeyItemRules`, LLM을 쓰지 않음): 보고서명에서 앞머리 꼬리표와 뒤 설명을 떼고 공백을 뺀 제목이 아래와 같을 때만입니다. 꼬리표는 없거나 `[기재정정]`일 때만 받습니다. `[첨부정정]`처럼 첨부만 고친 공시는 OpenDART가 그 접수번호의 행을 따로 주지 않아(2026-10-26 파이온엑스 `20261026000100`으로 확인) 종류를 정하지 않습니다. 제목이 '주요사항보고서('로 시작하지 않는 '유상증자결정'(기타법인 공시)도 API에 없어(지티엑스씨 `20261021000177`, 013) 정하지 않습니다. 단일판매·공급계약은 거래소 공시라 DS005에 API가 없습니다.

  | 제목 | `kind` | OpenDART API |
  | --- | --- | --- |
  | 주요사항보고서(유상증자결정) | `CAPITAL_INCREASE` | `piicDecsn.json` (apiId 2020023) |
  | 주요사항보고서(전환사채권발행결정) | `CONVERTIBLE_BOND` | `cvbdIsDecsn.json` (2020033) |
  | 주요사항보고서(신주인수권부사채권발행결정) | `BOND_WITH_WARRANT` | `bdwtIsDecsn.json` (2020034) |
  | 주요사항보고서(교환사채권발행결정) | `EXCHANGEABLE_BOND` | `exbdIsDecsn.json` (2020035) |
  | 주요사항보고서(자기주식취득결정) | `TREASURY_STOCK_ACQUISITION` | `tsstkAqDecsn.json` (2020038) |
  | 주요사항보고서(자기주식처분결정) | `TREASURY_STOCK_DISPOSAL` | `tsstkDpDecsn.json` (2020039) |
  | 주요사항보고서(소송등의제기) | `LITIGATION` | `lwstLg.json` (2020028) |
  | 주요사항보고서(타법인주식및출자증권양수결정) | `STOCK_ACQUISITION` | `otcprStkInvscrInhDecsn.json` (2020046) |

- **OpenDART 호출**: 여덟 API 모두 `corp_code`·`bgn_de`·`end_de`(최초접수일 기간)로 부르고, 행마다 `rcept_no`가 있습니다. 응답 행 중 `rcept_no`가 요청한 접수번호와 같은 행 하나를 씁니다(아래 비고 '정'인 원본은 예외).
  - 원본 공시(꼬리표 없음): `bgn_de`=`end_de`=접수일(`receivedDate`). 그날 낸 공시만 받습니다.
  - 비고(`rm`)에 '정'이 있는 원본(꼬리표 없음, 뒤에 정정본이 있음): 접수일 하루로 부르면 행의 `rcept_no`가 원본이 아니라 마지막 정정본입니다(2026-10-27 에코프로비엠 `20260630000676` → `20261013000198`). 같은 접수번호의 행이 없고 행이 하나뿐이면 그 행을 쓰고, 행의 접수번호를 `disclosure_key_item.source_rcept_no`에 저장합니다. 행이 둘 이상이면 고르지 않고 `NO_DATA`입니다. 관련 수시공시(3.6)와 같은 규칙이라 어느 기능이 먼저 불러도 저장 값이 같습니다([ADR-0030](adr/0030-related-disclosure-matching.md)).
  - `[기재정정]`: 기간이 최초 공시의 접수일 기준이고 행의 `rcept_no`는 마지막 정정본이라(2026-10-26 모아데이타 `20261023000402`: 정정일 20261023로는 013, 최초 접수일 20260814로 부르면 정정본 행이 옴), `bgn_de`=20150101(API가 정보를 주는 첫해)~`end_de`=접수일로 부릅니다.
- 캐시([ADR-0024](adr/0024-company-info-cache.md) 보고서에 딸린 자료): 접수번호마다 한 번만 받고 다시 받지 않습니다(`CachePolicy.permanent()`). `013`(자료 없음)이거나 같은 접수번호의 행이 없으면 `status: NO_DATA`, `items: []`로 저장하고 200으로 돌려줍니다. 호출 실패는 저장하지 않습니다.
- `items`: 종류마다 정한 항목을 정한 순서로 넣습니다. 값이 `-`이거나 비어 있는 항목은 뺍니다. `label`은 OpenDART 개발가이드의 항목 이름, `unit`은 개발가이드가 항목 이름에 붙인 단위(`원`, `주`, `%`, `원/주`)이고 없으면 null입니다. `field`는 OpenDART 응답 필드 이름(근거 위치)입니다. 금액은 대부분 원이지만 해외 발행 항목은 받지 않습니다.
- `sourceUrl`: 요청한 접수번호의 DART 공시뷰어 주소입니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| path | `corpCode` | string | 예 | 고유번호 |
| path | `rceptNo` | string | 예 | 접수번호(최근 공시 목록의 `rceptNo`) |

**응답 200** (에코프로비엠 `01160363` 자기주식처분결정 `20251020000144` 실제 응답에서 옮김, 일부 항목 생략)

```json
{
  "rceptNo": "20251020000144",
  "kind": "TREASURY_STOCK_DISPOSAL",
  "kindLabel": "자기주식 처분 결정",
  "status": "AVAILABLE",
  "items": [
    { "field": "dppln_stk_ostk", "label": "처분예정주식(보통주식)", "value": "65,168", "unit": "주" },
    { "field": "dpstk_prc_ostk", "label": "처분 대상 주식가격(보통주식)", "value": "161,000", "unit": "원" },
    { "field": "dppln_prc_ostk", "label": "처분예정금액(보통주식)", "value": "10,492,048,000", "unit": "원" },
    { "field": "dpprpd_bgd", "label": "처분예정기간(시작일)", "value": "2025년 10월 22일", "unit": null },
    { "field": "dp_pp", "label": "처분목적", "value": "종업원에 대한 상여금 지급 (RSU)", "unit": null }
  ],
  "sourceUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20251020000144",
  "fetchedAt": "2026-10-26T15:10:03"
}
```

- `status`: `AVAILABLE` 항목 있음, `NO_DATA` OpenDART에 자료 없음(013 또는 같은 접수번호의 행 없음. 비고 '정'인 원본은 행이 하나뿐이면 그 행을 써서 `AVAILABLE`). `NO_DATA`면 `items`는 빈 배열이고 화면은 '자료 없음'과 원문 링크를 보여 줍니다.
- `fetchedAt`: OpenDART에서 받은 시각입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |
| 404 | `COMPANY_DISCLOSURE_NOT_FOUND` | 이 기업의 저장된 최근 공시 목록에 없는 접수번호이거나, 핵심 수치를 지원하지 않는 종류(`keyItemsKind`가 null) |
| 502 | `DART_REQUEST_FAILED` | OpenDART 호출 실패 |
| 503 | `DART_RATE_LIMITED` | OpenDART 호출 한도 초과(020) |
| 503 | `DART_KEY_MISSING` | 서버에 OpenDART 키가 설정되지 않음 |

### GET /api/companies/{corpCode}/disclosure-signals — 확인해 볼 공시

- 이슈: #411 (1.2) · 기획서: FS-55 · 화면: 기업 화면 '기업 개요' 탭의 '확인해 볼 공시' 영역
- 최근 1년(오늘 − 365일 ~ 오늘, 한국 시간, 접수일 기준)에 이 기업이 낸 공시 가운데 아래 종류에 해당하는 공시를 모읍니다. 점수·등급·평가는 만들지 않고, 종류마다 공시 건수와 코드가 만든 사실 문장만 돌려줍니다(LLM을 쓰지 않음).
- 자료는 두 곳에서 옵니다.
  - **공시 목록**: 최근 공시 타임라인(`GET /api/companies/{corpCode}/disclosures?days=365`)과 같은 저장된 목록(`company_disclosure`, 같은 캐시)입니다. 공시 제목 규칙으로 종류를 정합니다.
  - **회계감사인의 명칭 및 감사의견**: 위 목록에 있는 사업보고서마다 OpenDART 정기보고서 주요정보 `accnutAdtorNmNdAdtOpinion.json`([DS002 2020009](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS002&apiId=2020009))을 `corp_code`·`bsns_year`(보고서명의 사업연도)·`reprt_code=11011`(사업보고서)로 부릅니다. 응답 필드 `bsns_year`(예 `제60기\n(당기)`), `adtor`(감사인), `adt_opinion`(감사의견), `stlm_dt`(결산기준일), `rcept_no`를 씁니다.
- **종류 정하기**(`backend/.../disclosure/domain/DisclosureSignalRules.java`). 제목은 최근 공시 타임라인과 같이 보고서명에서 앞머리 꼬리표(`[기재정정]` 등)와 뒤 설명(공백 여러 칸 뒤)을 떼고 공백을 모두 뺀 값입니다. 제목에 `자회사의주요경영사항`·`종속회사의주요경영사항`이 있으면 이 회사가 아닌 자회사의 일이라 어느 종류에도 넣지 않습니다. 제목은 2026-03-16~31·2026-07-01~09-30 OpenDART 공시검색(거래소공시·주요사항보고서) 실제 응답에 나온 것에서만 골랐습니다.

  | `kind` | `label` | 자료 | 맞는 규칙 | `sentence` |
  | --- | --- | --- | --- | --- |
  | `LARGEST_SHAREHOLDER_CHANGE` | 최대주주 변경 | 공시 목록 | 제목이 `최대주주변경`과 같음(`최대주주변경을수반하는주식양수도계약체결` 같은 계약 공시는 넣지 않음) | 최대주주가 바뀌었다고 공시했어요. |
  | `CAPITAL_INCREASE` | 유상증자 결정 | 공시 목록 | 제목이 `주요사항보고서(유상증자결정)`·`주요사항보고서(유무상증자결정)`·`유상증자결정`·`유무상증자결정` 중 하나와 같음 | 유상증자를 결정했다고 공시했어요. |
  | `CONVERTIBLE_BOND` | 전환사채 발행 결정 | 공시 목록 | 제목이 `주요사항보고서(전환사채권발행결정)`과 같음 | 전환사채 발행을 결정했다고 공시했어요. |
  | `BOND_WITH_WARRANT` | 신주인수권부사채 발행 결정 | 공시 목록 | 제목이 `주요사항보고서(신주인수권부사채권발행결정)`과 같음 | 신주인수권부사채 발행을 결정했다고 공시했어요. |
  | `LITIGATION` | 소송 등 제기 | 공시 목록 | 제목이 `주요사항보고서(소송등의제기)`와 같거나 `소송등의제기`로 시작(`소송등의제기ㆍ신청(...)`). 판결·결정 공시는 넣지 않음 | 소송 등이 제기됐다고 공시했어요. |
  | `REHABILITATION_LISTING` | 회생·상장 관련 공시 | 공시 목록 | 제목에 `회생절차`·`회생계획`·`상장폐지`·`관리종목`·`상장적격성실질심사` 중 하나가 있음 | 회생 절차나 상장 유지와 관련된 공시가 나왔어요. |
  | `AUDITOR_CHANGE` | 감사인 변경 | 감사의견 API | 사업보고서 응답의 당기 행(`bsns_year`에 `(당기)`)과 전기 행(`(전기)`)의 감사인(`adtor`, 공백을 빼고 비교) 모음이 다름. 어느 쪽이든 감사인이 없으면(`-`·빈 값) 넣지 않음 | 사업보고서에 적힌 감사인이 제59기(전기) 현대회계법인에서 제60기(당기) 대주회계법인으로 바뀌었어요. |
  | `NON_CLEAN_AUDIT_OPINION` | 감사의견(적정이 아님) | 감사의견 API | 당기 행의 감사의견(`adt_opinion`, 공백을 뺌)에 `한정`·`부적정`·`거절` 중 하나가 있음. `적정의견`이거나 `-`·빈 값, 그 밖의 값은 넣지 않음 | 사업보고서에 적힌 제60기(당기) 감사의견은 '의견거절'이에요. |

  꼬리표는 가리지 않습니다(공시 목록은 최종본만 받으므로 정정된 원본은 들어 있지 않음). 같은 일을 거래소 공시와 주요사항보고서로 두 번 냈으면 두 건으로 셉니다(건수는 공시 건수). 감사의견 값은 2026-10-27 실제 응답에서 `적정의견`·`의견거절`을 확인했고(삼성전자 `20260310002820`, 한창 `20260326001334`, 레드우즈 `20260407001696`), `한정`·`부적정`은 감사의견 종류 이름으로 넣었습니다.
- **사업보고서 고르기**: 공시 목록에서 보고서명이 12월 결산 사업보고서(`사업보고서 (YYYY.12)`, `ReportNameParser`)인 공시마다 한 번 부릅니다. 결산월이 12월이 아닌 사업보고서가 있으면 사업연도를 정할 수 없어 감사 두 종류를 `UNAVAILABLE`로 둡니다. 기간 안에 사업보고서가 없으면 두 종류는 `CHECKED`, 0건입니다.
- **감사의견 행 고르기**(정기보고서 주요정보와 같은 규칙): 응답에 이 사업보고서 접수번호의 행이 있으면 그 행만, 없으면 첫 행의 접수번호와 같은 행만 씁니다(뒤에 정정본이 나온 경우). 결산기준일(`stlm_dt`)이 보고서의 대상 기간 끝과 다르면 다른 기간의 자료라 쓰지 않습니다. 항목의 `rceptNo`·`dartUrl`은 공시 목록의 사업보고서 접수번호입니다.
- 캐시([ADR-0024](adr/0024-company-info-cache.md)): 공시 목록은 최근 공시 타임라인과 같습니다(받은 지 1시간이 지나면 다시 받음). 감사의견은 사업보고서 접수번호마다 저장하고(`disclosure_audit_opinion`) 자료가 있으면 다시 받지 않습니다. `013`(자료 없음)이나 쓸 행이 없으면 `NO_DATA`로 저장하고, 받은 지 1시간(`app.disclosures.refresh-after`)이 지나면 한 번 더 받습니다(제출 직후에는 자료가 아직 없을 수 있음).
- **받지 못함**: 공시 목록을 받지 못하고 저장된 목록도 없으면 여덟 종류 모두 `UNAVAILABLE`입니다(감사의견 API를 부를 사업보고서도 알 수 없음). 감사의견 API를 받지 못하면 감사 두 종류만 `UNAVAILABLE`입니다. `UNAVAILABLE` 종류의 `count`는 null이고 `items`에 그 종류의 항목이 없습니다. 0건(`CHECKED`, `count: 0`)과 구분합니다. 공시 목록을 다시 받다 실패해 저장된 목록을 쓰면 `CHECKED`이고, 저장된 목록이 요청 기간을 다 덮지 못하면 `from`이 저장된 기간 시작입니다.
- `items`: 접수일이 최근인 순서, 같은 날이면 접수번호가 큰 순서입니다. 한 공시는 한 종류에만 들어가지만, 사업보고서 한 건은 감사인 변경·감사의견 두 종류에 함께 들어갈 수 있습니다.
- `kinds`: 여덟 종류를 위 표 순서로 항상 다 넣습니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| path | `corpCode` | string | 예 | 고유번호 |

**응답 200** (가짜 회사·공시로 만든 예시. 감사의견 API를 받지 못한 경우)

```json
{
  "corpCode": "00000001",
  "from": "2025-10-27",
  "to": "2026-10-27",
  "kinds": [
    { "kind": "LARGEST_SHAREHOLDER_CHANGE", "label": "최대주주 변경", "status": "CHECKED", "count": 1 },
    { "kind": "CAPITAL_INCREASE", "label": "유상증자 결정", "status": "CHECKED", "count": 0 },
    { "kind": "CONVERTIBLE_BOND", "label": "전환사채 발행 결정", "status": "CHECKED", "count": 0 },
    { "kind": "BOND_WITH_WARRANT", "label": "신주인수권부사채 발행 결정", "status": "CHECKED", "count": 0 },
    { "kind": "LITIGATION", "label": "소송 등 제기", "status": "CHECKED", "count": 0 },
    { "kind": "REHABILITATION_LISTING", "label": "회생·상장 관련 공시", "status": "CHECKED", "count": 0 },
    { "kind": "AUDITOR_CHANGE", "label": "감사인 변경", "status": "UNAVAILABLE", "count": null },
    { "kind": "NON_CLEAN_AUDIT_OPINION", "label": "감사의견(적정이 아님)", "status": "UNAVAILABLE", "count": null }
  ],
  "items": [
    {
      "kind": "LARGEST_SHAREHOLDER_CHANGE",
      "rceptNo": "20260901900001",
      "reportName": "최대주주변경",
      "receivedDate": "2026-09-01",
      "sentence": "최대주주가 바뀌었다고 공시했어요.",
      "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260901900001"
    }
  ]
}
```

- `status`: `CHECKED` 확인함(0건이면 해당 공시 없음), `UNAVAILABLE` 이번에 확인하지 못함(OpenDART 호출 실패. 해당 공시가 없다는 뜻이 아님).
- `reportName`: 최근 공시 타임라인의 `reportName`과 같습니다(꼬리표는 그대로, 이어진 공백은 한 칸).
- `sentence`: 종류마다 코드가 정한 사실 문장입니다. 감사 두 종류는 응답의 기수(`bsns_year`의 공백을 뺀 값)·감사인·감사의견 원문을 그대로 넣습니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |

### GET /api/companies/{corpCode}/briefing — AI 기업 브리핑

- 이슈: #333 (1.2) · 기획서 FS-49 · 화면: 기업 화면 개요 탭 'AI 기업 브리핑' · [ADR-0025](adr/0025-company-briefing.md)
- 원문 보고서는 이 기업 정기보고서 목록(위 `GET …/reports`와 같은 캐시 규칙)에서 대상 기간이 가장 최근인 사업보고서, 없으면 가장 최근 정기보고서입니다.
- 그 보고서·현재 프롬프트 버전으로 저장된 브리핑이 있으면 그대로 돌려줍니다. 없으면 이 요청 안에서 만들어 저장한 뒤 돌려줍니다(동기 호출). 처음 만들 때는 원문 받기·구조화와 LLM 호출로 수 초~수십 초 걸릴 수 있습니다.
- 근거는 원문 'II. 사업의 내용'의 하위 목차(사업의 개요, 주요 제품, 매출, 위험관리)와 '투자자 보호' 항목에서 고른 문단·표(최대 8개)이고, 문장마다 그중 하나 이상을 인용합니다. 근거·숫자·표현 검사를 2회 다시 만든 뒤에도 통과하지 못하면 `REVIEW_NEEDED`이고 문장이 없습니다. `GENERATED`·`REVIEW_NEEDED`는 저장해 같은 보고서·프롬프트 버전이면 다시 만들지 않습니다.
- 사용자 정보는 쓰지 않습니다(로그인과 무관).

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| path | `corpCode` | string | 예 | 고유번호 |

**응답 200**

```json
{
  "corpCode": "00126380",
  "status": "GENERATED",
  "reason": null,
  "message": null,
  "report": { "rceptNo": "20260310000123", "reportName": "사업보고서 (2025.12)", "reportType": "ANNUAL",
    "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260310000123" },
  "sentences": [
    { "no": 1, "text": "회사는 반도체와 스마트폰을 만들어 판다고 밝혔어요.",
      "evidence": [ { "evidenceId": "20260310000123#B120", "rceptNo": "20260310000123", "sectionNo": 12,
        "blockNo": 120, "sectionPath": "II. 사업의 내용 > 1. 사업의 개요", "quote": "당사는 …" } ] }
  ],
  "aiGenerated": true,
  "ai": { "model": "fake-model", "promptVersion": "briefing-1", "generatedAt": "2026-10-26T10:12:03" }
}
```

- `status`
  - `GENERATED`: `sentences`에 문장(1~6개). 화면에 'AI 생성'으로 표시합니다.
  - `REVIEW_NEEDED`: 만들었지만 근거·숫자·표현 검사를 통과하지 못함. `sentences`는 빈 배열, `message`에 사유
  - `NOT_AVAILABLE`: 브리핑을 만들 자료가 없음. 저장하지 않으므로 자료가 생기면 다음 요청에서 만듭니다. `reason`에 사유
- `reason`(`NOT_AVAILABLE`일 때만): `NO_REPORT` 정기보고서가 없음(`report`는 null), `NO_DOCUMENT` 원문을 받거나 읽지 못함(OpenDART에 원문 없음·구조화 실패), `NO_SOURCE` 원문에서 '사업의 내용' 항목을 찾지 못함
- `evidence[]`: 문장이 인용한 원문 위치. `quote`는 인용 문단(표는 행마다 한 줄, 셀은 ` | `로 이음) 앞 600자입니다. `sectionPath`는 상위 목차부터 이은 제목입니다.
- `aiGenerated`·`ai`: AI가 만든 결과(`GENERATED`·`REVIEW_NEEDED`)면 true와 모델·프롬프트 버전·생성 시각, `NOT_AVAILABLE`이면 false와 null입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |
| 502 | `DART_REQUEST_FAILED` | 보고서 목록이나 원문을 OpenDART에서 받지 못함(저장된 목록이 있으면 그 목록을 씀) |
| 503 | `DART_RATE_LIMITED`, `DART_KEY_MISSING` | OpenDART 호출 한도 초과, 키 없음 |
| 503 | `AI_SERVER_UNAVAILABLE` | AI 서버 또는 LLM을 쓸 수 없음(저장하지 않음. 다시 요청하면 다시 만듦) |

### POST /api/companies/{corpCode}/questions — 사업보고서에 근거해 묻기

- 이슈: #365 (1.2) · 기획서 FS-53 · 화면: 기업 화면 개요 탭 'AI에게 묻기 · 사업보고서 기준' · [ADR-0029](adr/0029-company-question-answering.md)
- 분석 없이 기업 하나의 보고서 하나에 묻습니다. 대상 보고서는 AI 브리핑과 같은 규칙입니다: 이 기업 정기보고서 목록에서 대상 기간이 가장 최근인 사업보고서, 없으면 가장 최근 정기보고서. 원문은 접수번호 캐시를 그대로 씁니다(처음이면 받아 구조화).
- 동기 호출입니다. 질문 검사(앞뒤 공백을 뺀 2~200자)와 상태·답 검증은 분석 질문(`POST /api/analyses/{analysisId}/questions`)과 같습니다.
- backend가 그 보고서 원문 문단(`PARAGRAPH`)에서 질문 낱말로 후보를 최대 6개 찾아(분석 질문과 같은 낱말 규칙) ai-server `POST /internal/answers`에 `previousReport` 없이 보냅니다. 계정 사실 문장(`facts`)은 보내지 않습니다(비교가 없음). 후보가 없어도 ai-server를 부릅니다: 투자 판단 질문이면 `OUT_OF_SCOPE`, 아니면 `NOT_FOUND`이고 어느 쪽이든 LLM은 부르지 않습니다.
- 결과는 `company_question`에 저장합니다(같은 질문을 다시 해도 새로 답함). LLM 호출은 `llm_call`(task `answer`, `company_question_id`)에 남겨 AI 사용 현황에 잡힙니다. 사용자 정보는 쓰지 않습니다(로그인과 무관).

**요청**

```json
{ "question": "주요 제품은 무엇인가요?" }
```

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| path | `corpCode` | string | 예 | 고유번호 |
| body | `question` | string | 예 | 앞뒤 공백을 뺀 2~200자 |

**응답 200**

```json
{
  "questionId": 3,
  "question": "주요 제품은 무엇인가요?",
  "status": "ANSWERED",
  "answer": "회사는 스마트폰과 메모리 반도체를 주요 제품으로 밝혔어요[1].",
  "message": null,
  "citations": [
    { "no": 1, "evidenceId": "20260310000123#B130", "rceptNo": "20260310000123", "sectionNo": 13,
      "blockNo": 130, "sectionPath": "II. 사업의 내용 > 2. 주요 제품 및 서비스", "quote": "당사의 주요 제품은 …" }
  ],
  "report": { "rceptNo": "20260310000123", "reportName": "사업보고서 (2025.12)",
    "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260310000123" },
  "aiGenerated": true,
  "ai": { "model": "fake-model", "promptVersion": "answer-2", "generatedAt": "2026-10-26T10:12:03" },
  "createdAt": "2026-10-26T10:12:03"
}
```

- `status`: 분석 질문과 같습니다(`ANSWERED`·`NOT_FOUND`·`OUT_OF_SCOPE`·`REVIEW_NEEDED`). `ANSWERED`가 아니면 `answer`는 null, `citations`는 빈 배열이고 `message`에 안내가 있습니다. `NOT_FOUND`는 원문을 읽지 못했거나 관련 문단을 찾지 못한 경우입니다.
- `answer`: 문장 안의 `[1]`은 `citations[].no`입니다. `citations[].quote`는 문단 앞 160자, `sectionPath`는 상위 목차부터 이은 제목입니다.
- `report`: 답한 보고서(원문 보고서와 DART 링크).
- `aiGenerated`·`ai`: AI가 답을 만들었을 때만(`ANSWERED`·`REVIEW_NEEDED`) true와 모델·프롬프트 버전·생성 시각, 아니면 false와 null입니다.

**에러**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `question`이 비었거나 2자 미만·200자 초과(`errors[].field`=`question`) |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |
| 404 | `REPORT_NOT_FOUND` | 이 기업의 정기보고서가 없음 |
| 502 | `DART_REQUEST_FAILED` | 보고서 목록이나 원문을 OpenDART에서 받지 못함 |
| 503 | `DART_RATE_LIMITED`, `DART_KEY_MISSING` | OpenDART 호출 한도 초과, 키 없음 |
| 503 | `AI_SERVER_UNAVAILABLE` | AI 서버 또는 LLM을 쓸 수 없음(저장하지 않음) |

### GET /api/companies/{corpCode}/questions — 사업보고서 질문 기록

- 이슈: #365 (1.2) · 위와 같은 규칙으로 고른 지금의 대상 보고서에 한 질문만, 최신 순으로 최대 20개 돌려줍니다(새 사업보고서가 나오면 이전 보고서의 질문은 보이지 않음). 항목 모양은 위 응답과 같습니다. 정기보고서가 없으면 `report`는 null, `items`는 빈 배열입니다.

```json
{ "report": { "rceptNo": "20260310000123", "reportName": "사업보고서 (2025.12)", "dartUrl": "…" },
  "items": [ { "questionId": 3, "question": "…", "status": "ANSWERED", "answer": "…", "message": null,
  "citations": [], "report": { "…": "…" }, "aiGenerated": true, "ai": { "…": "…" },
  "createdAt": "2026-10-26T10:12:03" } ] }
```

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `COMPANY_NOT_FOUND` | 없는 고유번호 |
| 502·503 | `DART_*` | 위와 같음(저장된 보고서 목록이 있으면 그 목록을 씀) |

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
| 400 | `COMMON_INVALID_INPUT` | 필수 값 없음, `basis`가 정해진 값이 아님(`errors[].field`=`basis`) |
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
| 400 | `COMMON_INVALID_INPUT` | 필수 값 없음, `basis`가 정해진 값이 아님(`errors[].field`=`basis`) |
| 404 | `REPORT_NOT_FOUND` | 없는 보고서 |
| 422 | `ANALYSIS_NOT_COMPARABLE` | 비교 가능성 검증을 통과하지 못함(`message`에 첫 번째 사유) |
| 502·503 | `DART_REQUEST_FAILED`, `DART_RATE_LIMITED`, `DART_KEY_MISSING` | 검증에 필요한 재무제표를 받지 못함 |

### GET /api/analyses/{analysisId} — 분석 상태

- 이슈: #14 (2.3), #298 (4.2) · 화면: W-02(1초마다 조회), W-03

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
  "summaryMessage": null,
  "analysisVersion": "m2-9",
  "outdated": false
}
```

`analysisVersion`은 분석을 만들 때의 분석 방식 버전(`analysis.analysis_version`, 예: `"m2-9"`)이고, `outdated`는 그 값이 지금 서버의 버전(`Analysis.CURRENT_VERSION`)과 다르면 `true`입니다([ADR-0014](adr/0014-analysis-reuse-and-version.md)). 상태와 관계없이 늘 들어 있습니다. 이전 방식 결과는 다시 분석하기 전까지 그대로 보이므로, 화면은 `outdated`면 안내와 '새 방식으로 다시 분석'(같은 기업·보고서·비교 기준으로 `POST /api/analyses`)을 보여 줍니다(#298).

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
      "accountDetail": null,
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
| `accountDetail` | 자본변동표의 계정 상세(OpenDART `account_detail`, 자본 구성요소). 자본변동표는 같은 계정명(예: 기초자본)이 구성요소마다 여러 줄이라 이 값으로 구분한다. 다른 재무제표는 null(#401) |
| `direction` | `UP`, `DOWN`, `SAME`. 계산하지 못하면 null |
| `calcStatus` | ERD의 `financial_change.calc_status`와 같은 값 |
| `calcMessage` | 계산하지 못한 사유(예: "이전 값이 0이라 증감률을 계산하지 않습니다.") |

- 부호가 바뀌거나 이전 값이 음수인 계정은 증감률(`changeRate`)이 null이고 증감액만 있습니다(#144). 손익계산서의 이익 계정은 `TURNED_PROFIT`(흑자전환)·`TURNED_LOSS`(적자전환)·`LOSS_NARROWED`(적자폭 축소)·`LOSS_WIDENED`(적자폭 확대)로, 그 밖의 계정은 `SIGN_CHANGED`("부호가 바뀌어 증감률을 계산하지 않아요.")나 `PREVIOUS_NEGATIVE`로 둡니다. 판정표는 ERD `financial_change.calc_status`에 있습니다.
- 이익 계정 목록(표준계정 ID): `dart_OperatingIncomeLoss`(영업이익), `ifrs-full_ProfitLossFromOperatingActivities`(금융회사 영업이익), `ifrs-full_GrossProfit`(매출총이익), `ifrs-full_ProfitLossBeforeTax`(법인세비용차감전순이익), `ifrs-full_ProfitLoss`(당기순이익), `ifrs-full_ProfitLossAttributableToOwnersOfParent`(지배기업 소유주지분 순이익). 흑자·적자 표현은 이 계정에만 씁니다. 비지배지분 순이익·총포괄손익·주당이익은 넣지 않습니다(2024 사업보고서 7곳의 실제 응답으로 확인, #144). 법인세비용처럼 이익이 아닌 계정의 부호 변화를 '흑자전환'으로 부르지 않기 위해서입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `sjDiv`가 BS·IS·CIS·CF·SCE가 아님 |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 ID |
| 409 | `ANALYSIS_NOT_READY` | 분석이 아직 완료되지 않음 |

### GET /api/analyses/{analysisId}/financial-changes/{changeId} — 수치 근거 상세

- 이슈: #21 (3.3) · 화면: W-03 ② 계정 선택
- 완료된 분석의 그 분석 항목만 돌려줍니다. 다른 분석의 항목 번호면 404입니다.
- 계산하지 못한 항목은 `formula`·`rateFormula`가 null이고 `calcMessage`에 사유가 있습니다. 숫자를 채우지 않습니다. 증감액만 계산한 항목(`PREVIOUS_ZERO`, 부호 변화 상태 등)은 `formula`만 있고 `rateFormula`는 null입니다.
- 계산식의 금액마다 그 보고서의 기간 이름(`periodName`)을 괄호로 붙여 어느 기간끼리 비교했는지 보입니다(#144). 음수는 괄호로 감쌉니다. 기간 이름이 없으면 붙이지 않습니다.
- 한쪽 보고서에만 있는 계정이면 없는 쪽의 `previous` 또는 `current`가 null입니다.

**응답 200**: 목록 항목 필드에 아래를 더합니다.

```json
{
  "changeId": 901,
  "accountName": "매출액",
  "accountDetail": null,
  "accountKey": "ifrs-full_Revenue",
  "fsDiv": "CFS",
  "currency": "KRW",
  "formula": "152,000,000,000,000(제 57 기 반기) − 145,000,000,000,000(제 56 기 반기) = 7,000,000,000,000",
  "rateFormula": "7,000,000,000,000 ÷ 145,000,000,000,000(제 56 기 반기) × 100 = 4.83%",
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

- 이슈: #16 (2.5), #17 (2.6), #25 (3.7) · 화면: W-03 ③
- 완료된 분석의 그 분석 결과만 돌려줍니다. 섹션 거르기·검색도 그 분석의 변경 안에서만 합니다.
- 기본 순서는 확인 우선순위(2.6)입니다. 점수가 높은 것부터, 같으면 문서 순서이고, 순위를 매기지 않은 항목(`UNRANKED`, 판단 유보)은 뒤에 문서 순서로 둡니다. 우선순위는 확인할 순서이며 투자 판단이 아닙니다.
- `sort=document`면 현재 보고서의 문서 순서입니다(짝이 없는 이전 보고서 항목은 이전 보고서에서 있던 자리).
- 문단·표 하나가 변경 하나입니다. 섹션이 통째로 한쪽에만 있으면 그 섹션의 블록이 모두 추가 또는 삭제입니다.
- 같은 이름의 항목 수가 두 보고서에서 달라 짝을 정하지 못한 섹션은 숨기지 않고 `REVIEW_NEEDED` 하나로 남깁니다.
- 숫자만 바뀐 수정은 `NUMERIC_UPDATE`, 같은 글이 같은 섹션 안 다른 순서나 다른 섹션으로 옮겨진 것은 `MOVED` 하나입니다(#150). `MOVED`는 `previous`·`current` 두 쪽 미리보기와 근거 위치가 있고, `sectionPath`는 현재 보고서 쪽, `previousSectionPath`는 이전 보고서 쪽 섹션 경로입니다. 섹션 거르기·검색은 `sectionPath`(현재 쪽)로 합니다.
- `textStatus`가 `FAILED`면 `items`가 비어 있고 `textMessage`에 사유가 있습니다. 화면은 '변경 없음'으로 보여 주지 않습니다.
- 섹션 거르기(3.7): 최상위 섹션은 `sectionPath`의 첫 ` > ` 앞부분입니다(예: `XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 3. 제재 등과 관련된 사항`의 `XI. 그 밖에 투자자 보호를 위하여 필요한 사항`). `section`을 주면 그 섹션과 하위 섹션의 변경만 돌려줍니다. 고를 수 있는 섹션은 응답의 `sections`에 있습니다.
- 검색(3.7): `q`는 변경 전·후 전체 글(미리보기가 아니라 저장한 글)과 `sectionPath`에 들어 있는 것을 찾습니다. 대소문자를 가리지 않고, 앞뒤 공백은 지웁니다.
- `type`·`section`·`q`는 함께 씁니다(모두 맞는 것). 정렬과 쪽 나누기는 거른 뒤에 합니다.
- 유형 여러 개(#304): `type`에 유형을 쉼표로 이어 주면 그중 하나에 맞는 변경을 돌려줍니다. 화면의 '내용 변경'은 `type=ADDED,DELETED,MODIFIED`입니다. 알 수 없는 값이 하나라도 있으면 400입니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `type` | string | 아니오 | `ADDED`, `DELETED`, `MODIFIED`, `NUMERIC_UPDATE`, `MOVED`, `REVIEW_NEEDED` 중 하나 이상을 쉼표로 이어서(예: `ADDED,DELETED,MODIFIED`, 그중 하나에 맞는 것). 값마다 앞뒤 공백은 지우고, 같은 값을 두 번 써도 됩니다. 없거나 빈 값이면 전체 |
| query | `sort` | string | 아니오 | `priority`(기본) 확인 우선순위, `document` 문서 순서 |
| query | `section` | string | 아니오 | 최상위 섹션 제목(`sections[].title`과 같은 글). 500자까지. 없거나 빈 값이면 전체. 이 분석에 없는 섹션이면 `items`가 비어 있음 |
| query | `q` | string | 아니오 | 찾을 글. 앞뒤 공백을 지운 뒤 2~100자. 없거나 빈 값이면 검색하지 않음 |
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
  "section": null,
  "q": null,
  "page": 0,
  "size": 20,
  "totalItems": 57,
  "counts": { "all": 57, "added": 10, "deleted": 5, "modified": 22, "numericUpdate": 15, "moved": 3, "reviewNeeded": 2 },
  "sections": [
    { "title": "I. 회사의 개요", "count": 6 },
    { "title": "II. 사업의 내용", "count": 31 },
    { "title": "XI. 그 밖에 투자자 보호를 위하여 필요한 사항", "count": 20 }
  ],
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
      "previousSectionPath": null,
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
| `type` | 요청에 쓴 유형. 공백과 겹친 값을 뺀 뒤 처음 나온 순서대로 쉼표로 잇습니다(예: `ADDED,DELETED,MODIFIED`). 없으면 null |
| `totalItems` | `type`·`section`·`q`에 모두 맞는 전체 건수(쪽 나누기 전) |
| `section`·`q` | 요청에 쓴 거르기 값(`q`는 앞뒤 공백을 지운 값). 없으면 null |
| `counts` | 변경 유형별 건수(`added`·`deleted`·`modified`·`numericUpdate`·`moved`·`reviewNeeded`, `all`은 합). `section`·`q`에 맞는 것만 셉니다(`type`은 보지 않음). 둘 다 없으면 분석 전체 |
| `sections` | 이 분석에 변경이 있는 최상위 섹션 전부(문서 순서). `count`는 그 섹션에서 `type`·`q`에 맞는 건수(`section`은 보지 않음)이고 0일 수 있습니다. 변경이 하나도 없으면 빈 배열 |
| `blockType` | `PARAGRAPH` 문단, `TABLE` 표, `SECTION` 섹션 단위 검토 필요 |
| `numbersOnly` | 숫자만 바뀜(재무 표 등). `changeType`이 `NUMERIC_UPDATE`면 true, 그 밖은 false(`m2-8`까지의 결과에서는 `MODIFIED`에 true가 있음) |
| `previousSectionPath` | 위치 이동(`MOVED`)일 때 이전 보고서 쪽 섹션 경로(같은 섹션 안에서 순서만 바뀌었으면 `sectionPath`와 같음). 그 밖은 null |
| `sectionStatus` | 섹션 짝짓기 결과. `MATCHED`, `RENAMED`(제목이 조금 바뀐 섹션), `ADDED`, `DELETED`, `AMBIGUOUS` |
| `previousPreview`·`currentPreview` | 앞부분 240자. 수정이면 두 글이 처음 달라지는 곳 조금 앞부터 자르고 앞뒤에 `…`. 없는 쪽은 null |
| `similarity` | 수정·숫자만 바뀜·위치 이동일 때 두 글(숫자를 가리지 않은 원래 글)이 비슷한 정도(0~1) |

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `type`에 알 수 없는 값이 하나라도 있음(빈 항목 포함, 예: `ADDED,`), `sort`·`page`·`size`가 범위 밖, `section`이 500자 초과, `q`가 2자 미만이거나 100자 초과(`errors[].field`에 이름) |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 ID |
| 409 | `ANALYSIS_NOT_READY` | 분석이 아직 완료되지 않음 |

### GET /api/analyses/{analysisId}/text-changes/{changeId} — 문장·표 근거 상세

- 이슈: #22 (3.4) · 화면: W-03 ③ 변경 항목의 '근거 상세'
- 완료된 분석의 그 분석 항목만 돌려줍니다. 다른 분석의 항목 번호면 404입니다.
- 변경 전·후 원문 전체를 보고서·종류·대상 기간·항목(섹션 경로)·위치(블록 번호, 근거 ID)와 함께 돌려줍니다. 없는 쪽(추가의 이전, 삭제의 현재)은 null입니다. 위치 이동(`MOVED`)은 두 쪽이 모두 있고, 각 쪽 `sectionPath`가 옮기기 전·후 섹션입니다.
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

### GET /api/analyses/{analysisId}/text-changes/{changeId}/history — 문장 변경 이력

- 이슈: #26 (3.8) · 화면: 와이어프레임 없음(W-03 ③ 근거 상세 아래 '이력')
- 고른 변경 항목의 글이 이 기업의 다른 보고서들에서 언제 추가·삭제·수정됐는지 오래된 보고서부터 돌려줍니다([ADR-0028](adr/0028-text-change-history-from-completed-analyses.md)).
- 이미 완료된 분석만 이어 붙입니다. 새 분석을 만들지 않고 OpenDART·ai-server를 부르지 않습니다.
- 이어 붙이기: 고른 분석의 이전 보고서에서 시작해, 그 보고서를 현재 보고서로 둔 완료 분석(이전 보고서가 가장 가까운 기간인 것)으로 한 칸씩 과거로 갑니다. 고른 분석의 현재 보고서에서는 같은 방법으로 미래로 갑니다. 같은 보고서 쌍이 여러 번 완료됐으면 가장 최근에 완료된 것을 씁니다.
- 글 따라가기: 이어 붙인 분석에서 따라가는 글과 같은 글을 가진 변경 항목을 찾습니다. 있으면 그 변경(수정·숫자만 바뀜·위치 이동이면 반대쪽 글을 이어서 따라감)이고, 없으면 그 두 보고서 사이에 바뀌지 않은 것입니다. 추가(과거로 갈 때)나 삭제(미래로 갈 때)를 만나면 거기서 멈춥니다.
- 이어 붙인 분석이 건너뛴 보고서(예: 전년 동기 비교 사이의 분기보고서)와, 분석이 없어 더 가지 못한 양 끝의 바로 옆 보고서는 `NOT_ANALYZED`로 넣습니다. 비어 있는 기간을 '변경 없음'처럼 보이게 하지 않습니다.
- 문장 비교가 실패(`textStatus: FAILED`)한 분석은 없는 것으로 봅니다. 일부만 비교(`PARTIAL`)했거나 같은 섹션에 짝을 정하지 못한 항목(`REVIEW_NEEDED`)이 있어 같은 글을 찾지 못하면 그 보고서는 `REVIEW_NEEDED`이고 거기서 멈춥니다.
- 고른 항목이 `REVIEW_NEEDED`(글 없음)면 그 분석의 두 보고서만 `REVIEW_NEEDED`로 돌려줍니다.
- 근거 위치: 변경 항목이 있는 보고서는 그 항목의 위치를 씁니다. 바뀌지 않은 보고서는 그 보고서의 저장된 원문(`document_block`)에서 글이 똑같은 블록을 찾아(여럿이면 문서 순서상 첫 블록) 그 위치를 씁니다. 원문이 저장되지 않았거나 같은 글의 블록이 없으면 글을 보여 주지 않고 `REVIEW_NEEDED`로 두되, 분석상 바뀌지 않았으므로 다음 보고서로 계속 따라갑니다.
- 한 방향으로 최대 20개 분석까지 이어 붙입니다.

**응답 200**

```json
{
  "analysisId": 42,
  "changeId": 3001,
  "entries": [
    {
      "report": { "rceptNo": "20250515000321", "reportName": "분기보고서 (2025.03)", "reportType": "Q1", "periodEnd": "2025-03-31", "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250515000321" },
      "status": "NOT_ANALYZED",
      "text": null,
      "sectionPath": null,
      "evidenceId": null,
      "change": null
    },
    {
      "report": { "rceptNo": "20250814000987", "reportName": "반기보고서 (2025.06)", "reportType": "HALF", "periodEnd": "2025-06-30", "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250814000987" },
      "status": "PRESENT",
      "text": "당사는 메모리 반도체를 만듭니다.",
      "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
      "evidenceId": "20250814000987#B41",
      "change": null
    },
    {
      "report": { "rceptNo": "20260814001234", "reportName": "반기보고서 (2026.06)", "reportType": "HALF", "periodEnd": "2026-06-30", "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814001234" },
      "status": "PRESENT",
      "text": "당사는 메모리 반도체와 파운드리 사업을 합니다.",
      "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
      "evidenceId": "20260814001234#B44",
      "change": { "analysisId": 42, "changeId": 3001, "changeType": "MODIFIED" }
    }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `entries` | 보고서 기간(`periodEnd`)이 오래된 것부터. `report`는 정기보고서 목록 항목의 일부이고, `dartUrl`은 그 보고서의 DART 원문 주소(화면의 '출처: DART' 링크, 5.6) |
| `status` | `PRESENT` 그 보고서에 글이 있고 근거 위치가 있음, `ABSENT` 없음(추가되기 전이거나 삭제된 뒤), `NOT_ANALYZED` 앞 보고서와 비교한 완료 분석이 없어 알 수 없음, `REVIEW_NEEDED` 비교는 했지만 글을 찾지 못했거나 근거 위치를 찾지 못함 |
| `text` | `PRESENT`일 때 그 보고서의 글. 그 밖은 null |
| `sectionPath`·`evidenceId` | `PRESENT`면 항상 있는 근거 위치(섹션 경로, `{rceptNo}#B{blockNo}`). 변경 항목이 있으면 그 항목의 위치, 바뀌지 않았으면 저장된 원문에서 같은 글을 찾은 블록의 위치. 그 밖은 null |
| `change` | 바로 앞 항목에서 이 보고서로 오며 생긴 변경(`changeType`은 목록과 같은 값). 바뀌지 않았거나 알 수 없으면 null. `changeId`로 근거 상세를 열 수 있음 |

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND`, `ANALYSIS_TEXT_CHANGE_NOT_FOUND` | 없는 분석·변경 항목 |
| 409 | `ANALYSIS_NOT_READY` | 분석이 아직 완료되지 않음 |

### POST /api/analyses/{analysisId}/text-changes/{changeId}/explanations — 문장 변경 AI 한 줄 풀이

- 이슈: #227 (3.11) · 화면: W-03 ③ 카드의 'AI 한 줄 풀이' · 기획서 FS-6
- 그 변경의 이전·현재 문단만 근거로 한 문장 풀이를 돌려줍니다. 순서:
  1. 이미 저장된 풀이가 있으면 그대로(`cached: true`, AI 호출 없음)
  2. 요약(`summary_item`)에 그 변경의 AI 문장이 있으면 그 문장을 저장하고 돌려줌(AI 호출 없음)
  3. 짝을 찾지 못해 원문이 없는 변경(`REVIEW_NEEDED` 유형 등)은 AI 없이 `NO_SOURCE`
  4. 아니면 `POST /internal/summaries`를 문장 항목 하나(`textItems` 1개, `financialItems` 빈 목록)로 불러 만들고 저장(근거·숫자·표현 검사는 요약과 같음)
- 저장은 분석·변경마다 하나입니다(다시 만들지 않음). 완료된 분석에만 씁니다.

**응답 200**

```json
{
  "changeId": 5512,
  "status": "OK",
  "sentence": "현재 보고서에 종속회사의 과징금 납부 사실이 새로 적혔어요.",
  "message": null,
  "evidence": [
    { "side": "current", "rceptNo": "20260814003699", "sectionNo": 212, "blockNo": 1840, "sectionPath": "II. 사업의 내용 > 7. 기타 참고사항", "evidenceId": "20260814003699#B1840" }
  ],
  "aiGenerated": true,
  "ai": { "model": "fake-model", "promptVersion": "summary-2", "generatedAt": "2026-10-25T09:40:11" },
  "cached": false
}
```

- `status`: `OK`(풀이 있음), `REVIEW_NEEDED`(검증·표현 검사를 통과하지 못함, `sentence` null, `message`에 사유), `NO_SOURCE`(풀이할 원문이 없음, `sentence` null)
- `evidence`: 풀이가 인용한 원문 위치. `aiGenerated`는 `sentence`가 AI 문장(`OK`)이면 true이고 화면은 이 값으로 'AI 생성'을 표시합니다(5.6). `ai`는 AI 문장일 때만(`NO_SOURCE`면 null).
- `evidence[].sectionNo`·`sectionPath`: 근거 블록이 속한 그 보고서 원문의 섹션 번호와 상위부터 이은 경로. 화면이 원문 탭을 그 블록에서 엽니다(`GET .../documents/{side}/sections/{sectionNo}`). 섹션 번호는 분석 때 저장한 위치이고, 경로는 구조화된 원문에서 읽으며 원문을 쓸 수 없으면 변경의 섹션 경로로 대신합니다. 찾지 못하면 null입니다.
- 요청 본문은 없습니다(`POST`만 보냄).

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 |
| 404 | `ANALYSIS_TEXT_CHANGE_NOT_FOUND` | 이 분석의 변경 항목이 아님 |
| 409 | `ANALYSIS_NOT_READY` | 분석이 끝나지 않음 |
| 503 | `AI_SERVER_UNAVAILABLE` | AI 서버 또는 LLM을 쓸 수 없음(저장하지 않음) |

### GET /api/analyses/{analysisId}/text-changes/{changeId}/related-disclosures — 관련 수시공시(보조 근거)

> 상태: 초안. 범위 승인(#24)과 팀 확인(#337)을 받았고, 구현은 #343입니다. 설계 이유는 [ADR-0030](adr/0030-related-disclosure-matching.md), 사전 조사는 [`docs/research/3.6-related-disclosure.md`](research/3.6-related-disclosure.md)에 있습니다.

- 이슈: #343 (3.6) · 화면: W-03 ③ 변경 항목 아래 '관련 수시공시(보조)' 영역
- 두 보고서 사이 기간(이전 보고서 기간 말일 ~ 현재 보고서 제출일, `window`)에 이 기업이 낸 수시공시 중, 이 문장 변경과 같은 규칙에 걸린 공시입니다. 원인이라는 뜻이 아닙니다. 공시 제목·접수일·DART 링크만 주고 본문은 주지 않습니다. LLM을 쓰지 않습니다.
- 순서:
  1. 이 분석·현재 규칙 버전으로 계산해 둔 결과가 있으면 그대로 읽습니다(`cached: true`, OpenDART 호출 없음).
  2. 없으면 이 분석의 모든 문장 변경을 한 번에 계산해 저장하고 이 변경의 결과를 돌려줍니다. 공시 목록은 OpenDART 공시검색(`list.json`)을 상세유형 `B001`·`I001`·`I002`, `last_reprt_at=N`(정정 전 원본 포함)으로 받고, 같은 기업·기간은 한 번만 받습니다.
- 연결 강도(`matchLevel`): `TYPE_ONLY` 같은 종류(변경의 섹션 경로·글과 공시 제목이 같은 규칙에 걸림), `STRONG` 내용 일치(주요사항보고서 주요정보 DS005의 값이 변경 글에 있음. 유상증자 신주 수, 소송 원고(사건 명칭은 원고와 함께 맞을 때만 근거로 남김, ADR-0032), 타법인 주식 양수 대상 회사). 비고(`rm`)에 '철'이 있는 공시는 연결하지 않습니다.
- 대조할 글: 현재 글이 있으면 현재 글·섹션 경로(`ADDED`·`MODIFIED`·`NUMERIC_UPDATE`·`MOVED`), 없으면 이전 글·섹션 경로(`DELETED`)입니다. `MOVED`는 `previousSectionPath`도 함께 봅니다. `REVIEW_NEEDED`도 빼지 않고 있는 쪽 글로 같은 규칙을 적용합니다. 모든 `changeType`에 이 API를 쓸 수 있습니다.
- 주요정보는 최근 공시 핵심 수치(`GET .../disclosures/{rceptNo}/key-items`, #363)와 같은 저장(`disclosure_key_item`, 공시마다 한 번)을 씁니다. 그 API에 없는 종류 `LITIGATION`(소송 등의 제기)·`STOCK_ACQUISITION`(타법인 주식 및 출자증권 양수결정)을 공통 값 `keyItemsKind`에 더합니다(#363 담당자와 합의함).
- 정정 공시: 공시 목록에 원본(비고 '정')과 같은 제목의 `[기재정정]` 공시가 함께 있으면 정정본만 보여 줍니다. 정정본이 기간 뒤에 나왔으면 원본을 보여 주고, 주요정보로 최신 정정본을 알면 `latestRceptNo`·`dartUrl`을 그 접수번호로 줍니다.
- `items`는 `STRONG` 먼저, 같으면 접수일이 최근인 순서입니다. 모두 줍니다(화면이 처음 5건만 펼치고 나머지 '같은 종류'를 접음).
- 공시 목록을 받지 못하면 에러가 아니라 200 `UNAVAILABLE`이고 저장하지 않습니다(다음 요청에서 다시 받음). DS005를 받지 못하면 `TYPE_ONLY`로만 답하고 저장하지 않습니다(`partial: true`). 받아야 할 DS005가 0건이거나 자료 없음(`013`)이면 받은 것으로 보고 저장합니다. 찾은 공시가 0건(`NOT_FOUND`)이어도 저장해 다음 요청은 `cached: true`입니다. 이 API의 실패는 분석 상태와 재무·문장 결과에 영향을 주지 않습니다.
- 완료된 분석에만 씁니다. 처음 계산은 수 초 걸릴 수 있어 화면은 '불러오는 중'을 보여 줍니다.

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| path | `analysisId` | number | 예 | 분석 ID |
| path | `changeId` | number | 예 | 문장 변경 ID(`text-changes` 목록의 `changeId`) |

**응답 200**

```json
{
  "analysisId": 2,
  "changeId": 2585,
  "status": "FOUND",
  "unavailableReason": null,
  "partial": false,
  "window": { "from": "2025-06-30", "periodEnd": "2026-06-30", "to": "2026-08-14" },
  "ruleVersion": "related-2",
  "computedAt": "2026-11-05T10:12:40",
  "cached": false,
  "items": [
    {
      "rceptNo": "20260630000676",
      "latestRceptNo": "20261013000198",
      "reportName": "주요사항보고서(유상증자결정)",
      "receivedDate": "2026-06-30",
      "disclosureType": "B001",
      "timing": "DURING",
      "matchRule": "equity-financing",
      "matchRuleLabel": "유상증자·감자",
      "matchLevel": "STRONG",
      "matchedFields": ["NEW_SHARES"],
      "remarks": "정",
      "dartUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261013000198"
    }
  ],
  "notice": "같은 기간에 공개된 관련 공시입니다. 변경의 원인을 뜻하지 않습니다."
}
```

위 예시의 접수번호는 에코프로비엠(`01160363`) 2025 반기 ↔ 2026 반기 사전 조사 값이고, `analysisId`·`changeId`·`computedAt`은 설명용입니다.

- `status`: `FOUND` 1건 이상, `NOT_FOUND` 찾지 못함(화면: '이 기간에 이 항목과 연결된 수시공시를 찾지 못했습니다'. 공시가 없다는 단정이 아님), `UNAVAILABLE` 공시 목록을 지금 받지 못함(화면: '공시 목록을 지금 불러오지 못했습니다' + 다시 시도)
- `unavailableReason`: `UNAVAILABLE`일 때 사유(`DART_REQUEST_FAILED`, `DART_RATE_LIMITED`, `DART_KEY_MISSING`). 아니면 null
- `partial`: DS005를 받지 못해 `STRONG` 판정을 하지 못했으면 true
- `window`: `from` 조회 시작(이전 보고서 기간 말일), `periodEnd` 현재 보고서 기간 말일, `to` 조회 끝(현재 보고서 제출일)
- `ruleVersion`: 연결 규칙 버전(`RelatedDisclosureRules.RULE_VERSION`). 바뀌면 다음 요청 때 다시 계산합니다
- `computedAt`: 계산한 시각. `UNAVAILABLE`이거나 `partial`이면 이번 응답을 만든 시각
- `items[].rceptNo`: 기간 안에 받은 공시의 접수번호. `latestRceptNo`: 주요정보(DS005)로 확인한 최신 정정본 접수번호(모르면 `rceptNo`와 같음). `dartUrl`은 `latestRceptNo`로 엽니다
- `items[].receivedDate`: `rceptNo`의 접수일
- `items[].disclosureType`: 공시상세유형 `B001` 주요사항보고서, `I001` 수시공시, `I002` 공정공시
- `items[].timing`: `DURING` 현재 보고서 기간 안(접수일 ≤ `periodEnd`), `AFTER` 기간 뒤~제출 전
- `items[].matchRule`·`matchRuleLabel`: 걸린 규칙 키와 화면 이름. 여러 규칙에 걸리면 규칙 순서의 첫 규칙
- `items[].matchedFields`: `STRONG`일 때 일치한 값의 종류(`NEW_SHARES` 신주 수, `PLAINTIFF` 원고, `CASE_NAME` 사건 명칭(`PLAINTIFF`와 함께만), `TARGET_COMPANY` 대상 회사). `TYPE_ONLY`면 빈 배열
- `items[].remarks`: 비고(`rm`) 원문(최근 공시 API와 같음). 없으면 null
- `notice`: 고정 문구. 화면은 영역 맨 아래에 그대로 보여 줍니다
- `status`가 `NOT_FOUND`·`UNAVAILABLE`이면 `items`는 빈 배열입니다

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 |
| 404 | `ANALYSIS_TEXT_CHANGE_NOT_FOUND` | 이 분석의 문장 변경이 아님 |
| 409 | `ANALYSIS_NOT_READY` | 분석이 끝나지 않음 |

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

- 이슈: #20 (3.2), #143 (설명 등급·인용) · 화면: W-03 ① · [ADR-0015](adr/0015-explanation-grade-and-quote-check.md)
- 요약할 변화는 코드가 고릅니다(5절 잠정 규칙). 재무 수치의 사실 문장(`factSentence`)은 코드가 계산한 값으로 만들고, LLM은 문장 변화의 요약과 공시에 적힌 설명(`aiText`)만 씁니다.
- AI 서버가 LLM 문장의 근거 ID가 보낸 원문 위치인지, 문장의 숫자가 그 원문에 있는지 확인하고, 투자 권유성 표현 검사(5.5)를 합니다. 통과하지 못하면 2회까지 다시 만들고, 그래도 통과하지 못한 항목은 요약에서 빼고 `reviewNeeded`에 남깁니다. 표현 검사에 걸린 항목은 `reviewNeeded[].blockedRules`에 걸린 규칙 ID가 있습니다(5절 잠정 규칙).
- backend도 저장하기 전에 다시 확인합니다: 요청한 항목인지, 같은 항목이 두 번 오지 않았는지, AI 문장의 근거가 그 항목에 보낸 원문 위치인지. 통과하지 못하거나 응답에 빠진 항목은 `reviewNeeded`에 남습니다.
- 분석이 끝난 뒤 원문을 다시 구조화했으면 근거의 `sectionNo`·`blockNo`가 null입니다(블록 번호가 다른 글을 가리킬 수 있어 열지 않음).
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
      "explanationGrade": "STATED",
      "quote": "매출액은 메모리 수요 회복으로 증가하였습니다",
      "quoteEvidence": { "evidenceId": "20260814001234#B812", "side": "current", "rceptNo": "20260814001234", "sectionNo": 41, "blockNo": 812 },
      "gradeReason": null,
      "evidence": [{ "evidenceId": "20260814001234#B812", "side": "current", "rceptNo": "20260814001234", "sectionNo": 41, "blockNo": 812 }],
      "ai": { "model": "fake-model", "promptVersion": "summary-3", "generatedAt": "2026-10-21T14:07:12" }
    },
    {
      "itemNo": 3, "kind": "FINANCIAL",
      "target": { "type": "FINANCIAL", "changeId": 102, "sjDiv": "IS" },
      "factSentence": "영업이익이 6조 원에서 9조 원으로 늘었어요(+50.0%).",
      "aiText": null,
      "aiGenerated": false,
      "explanationStatus": "NOT_FOUND",
      "explanationGrade": "NONE",
      "quote": null,
      "quoteEvidence": null,
      "gradeReason": "인용문이 후보 원문에 그대로 없어 설명으로 쓰지 않았어요.",
      "evidence": [],
      "ai": null
    },
    {
      "itemNo": 2, "kind": "TEXT",
      "target": { "type": "TEXT", "changeId": 5512, "sjDiv": null },
      "factSentence": null,
      "aiText": "미국에 공장 2곳을 새로 짓는다는 내용이 들어갔어요.",
      "aiGenerated": true,
      "explanationStatus": null,
      "explanationGrade": null, "quote": null, "quoteEvidence": null, "gradeReason": null,
      "evidence": [{ "evidenceId": "20260814001234#B44", "side": "current", "rceptNo": "20260814001234", "sectionNo": 3, "blockNo": 44 }],
      "ai": { "model": "fake-model", "promptVersion": "summary-3", "generatedAt": "2026-10-21T14:07:12" }
    }
  ],
  "reviewNeededCount": 1,
  "reviewNeeded": [
    { "itemNo": 4, "kind": "TEXT", "target": { "type": "TEXT", "changeId": 5520, "sjDiv": null }, "reason": "원문에 없는 숫자(3)를 썼어요.", "blockedRules": [] }
  ]
}
```

- `summaryStatus`: `COMPLETED`(모두 근거 확인), `PARTIAL`(검토 필요 항목이 있음), `EMPTY`(요약할 변화가 없음). M1에서 만든 분석에는 `null`입니다.
- `kind`: `FINANCIAL`(재무 수치. `target.changeId`는 `financial-changes`의 `changeId`), `TEXT`(문장 변화. `target.changeId`는 `text-changes`의 `changeId`).
- `explanationStatus`(재무 수치만): `FOUND`(공시에 적힌 설명이 있음), `NOT_FOUND`(확인된 설명 없음. 화면에 그렇게 표시), `REVIEW_NEEDED`(설명을 만들었지만 근거를 확인하지 못함. 사실 문장은 보이고 설명은 `reviewNeeded`에도 셈).
- `explanationGrade`(재무 수치만, ADR-0015): 후보 원문이 그 변화를 어떻게 다루는지입니다. 문장 변화와 `REVIEW_NEEDED`면 null이고, 등급 기능 전에 만든 분석(분석 버전 m2-9 이하)도 null입니다.

  | 값 | `explanationStatus` | 화면 | `quote`·`quoteEvidence` |
  | --- | --- | --- | --- |
  | `STATED` | `FOUND` | "회사는 공시에서 이렇게 설명했어요" + 설명·인용문·위치 | 있음 |
  | `RELATED` | `FOUND` | "관련 공시 내용" + 설명·인용문·위치. 원인으로 읽히는 문구를 붙이지 않음 | 있음 |
  | `NONE` | `NOT_FOUND` | "확인된 설명 없음". `gradeReason`이 있으면 "관련 문단은 있지만 인용을 원문에서 확인하지 못했어요" | null |

- `quote`: 회사 공시에서 그대로 옮긴 인용문(공백 차이만 허용). `quoteEvidence`: 인용 위치(`evidence[]`와 같은 모양). 누르면 원문 확인(④)의 그 블록을 엽니다.
- `gradeReason`: 코드가 LLM의 등급을 낮췄을 때만 그 사유입니다(인용 위치가 후보가 아님·인용문이 원문에 없음이면 `NONE`, 인용문에 계정 이름이 없으면 `RELATED`). 낮추지 않았으면 null입니다. 화면은 `NONE`일 때 이 값이 있으면 후보가 없던 경우와 다른 문구를 씁니다.
- `aiGenerated`가 true인 문장(`aiText`)은 화면에 'AI 생성'으로 표시하고 `ai`(모델·프롬프트 버전·생성 시각)를 함께 보여 줍니다. 사실 문장(`factSentence`)은 코드가 만든 문장이라 'AI 생성'이 아닙니다.
- `evidence[]`는 `aiText`의 근거입니다. `side`·`sectionNo`·`blockNo`로 원문 확인(④)을 엽니다. `side`가 null이면 분석의 보고서가 아닌 근거라 열지 않습니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 ID |
| 409 | `ANALYSIS_NOT_READY` | 분석이 끝나지 않음 |

### POST /api/analyses/{analysisId}/questions — 근거로 답하는 질문

- 이슈: #219 (3.10) · 화면: W-03 ⑤ · [ADR-0023](adr/0023-grounded-question-answering.md)
- 완료된 분석에만 묻습니다. 동기 호출이고 보통 수 초 걸립니다.
- backend가 두 보고서 원문 문단에서 질문 낱말로 후보를 최대 6개 찾고, 질문에 이 분석의 계정이 나오면 코드가 만든 사실 문장을 함께 ai-server(`POST /internal/answers`)에 보냅니다. 후보도 사실도 없으면 ai-server를 부르지 않고 `NOT_FOUND`입니다.
- 질문에 이 분석의 섹션 제목(문장 변경의 섹션 경로에 나오는 대목차·하위 목차 제목, 공백·앞 번호(`II.`·`7.`)·따옴표·괄호 무시, 4자 미만 제목과 `(목차 밖 본문)` 제외)이 들어 있으면 가장 긴 제목의 섹션(하위 목차면 그 하위 섹션까지)으로 범위를 좁힙니다. 그 범위에 문장 변경(추가·삭제·수정·숫자만 바뀜·위치 이동, 검토 필요 제외)이 있으면 낱말 검색 대신 그 변경의 현재·이전 문단을 확인 우선순위 점수가 높은 순, 같으면 문서 순서로 최대 6개 후보로 보냅니다(#258). 범위에 변경이 없으면 낱말 검색으로 찾습니다. 사실 문장은 같습니다.
- 결과는 `analysis_question`에 저장합니다(같은 질문을 다시 해도 새로 답함).

**요청**

```json
{ "question": "매출액은 왜 늘었나요?" }
```

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| body | `question` | string | 예 | 앞뒤 공백을 뺀 2~200자 |

**응답 200**

```json
{
  "questionId": 7,
  "question": "매출액은 왜 늘었나요?",
  "status": "ANSWERED",
  "answer": "회사는 메모리 수요 회복으로 매출이 늘었다고 밝혔어요[1]. 매출액은 153.7조 원에서 305.4조 원으로 늘었어요[F1].",
  "message": null,
  "citations": [
    { "no": 1, "evidenceId": "20260814003699#B812", "side": "current", "rceptNo": "20260814003699",
      "reportName": "반기보고서 (2026.06)", "sectionNo": 31, "blockNo": 812,
      "sectionPath": "IV. 이사의 경영진단 및 분석의견 > 2. 영업실적", "quote": "매출액은 메모리 수요 회복으로 …" }
  ],
  "facts": [
    { "ref": "F1", "changeId": 4221, "sjDiv": "IS", "accountName": "매출액",
      "sentence": "매출액이 153.7조 원에서 305.4조 원으로 늘었어요(+98.7%)." }
  ],
  "aiGenerated": true,
  "ai": { "model": "fake-model", "promptVersion": "answer-2", "generatedAt": "2026-10-24T10:12:03" },
  "feedback": null,
  "createdAt": "2026-10-24T10:12:03"
}
```

- `status`
  - `ANSWERED`: `answer`에 답. 문장 안의 `[1]`은 `citations[].no`, `[F1]`은 `facts[].ref`입니다.
  - `NOT_FOUND`: 두 보고서에서 관련 문단·수치를 찾지 못함. `answer`는 null, `message`에 안내
  - `OUT_OF_SCOPE`: 매수·매도·목표주가·주가 전망 질문이라 답하지 않음. LLM을 부르지 않음
  - `REVIEW_NEEDED`: 답이 근거·숫자·표현 검사를 통과하지 못함(2회 다시 만든 뒤). `answer`는 null
- `citations`: 답이 인용한 원문만 번호 순서대로. `quote`는 문단 앞 160자입니다. `facts`: 답이 인용한 사실(코드가 계산)만.
- `aiGenerated`: `answer`가 AI가 만든 답(`ANSWERED`)이면 true, 그 밖은 false입니다. 화면은 이 값으로 'AI 생성'을 표시합니다(5.6).
- `ai`: AI가 답을 만들었을 때만(모델·프롬프트 버전·생성 시각). `NOT_FOUND`·`OUT_OF_SCOPE`면 null입니다.
- `feedback`: 이 답의 평가 `{ "helpful": true|false, "reason": "WRONG_SOURCE"|… |null }`. 평가하지 않았으면 null입니다(새 질문은 늘 null). 값은 아래 `PUT …/feedback`과 같습니다.

**에러**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `question`이 비었거나 2자 미만·200자 초과(`errors[].field`=`question`) |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 |
| 409 | `ANALYSIS_NOT_READY` | 분석이 끝나지 않음 |
| 503 | `AI_SERVER_UNAVAILABLE` | AI 서버 또는 LLM을 쓸 수 없음 |

### GET /api/analyses/{analysisId}/questions — 질문·답 기록

- 이슈: #219 (3.10) · 이 분석에서 한 질문을 최신 순으로 최대 20개 돌려줍니다. 항목 모양은 위 응답과 같습니다.

```json
{ "items": [ { "questionId": 7, "question": "…", "status": "ANSWERED", "answer": "…", "message": null,
  "citations": [], "facts": [], "aiGenerated": true, "ai": null, "feedback": { "helpful": false, "reason": "WRONG_SOURCE" },
  "createdAt": "2026-10-24T10:12:03" } ] }
```

| 상태 | code | 언제 |
| --- | --- | --- |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 |

### PUT /api/analyses/{analysisId}/questions/{questionId}/feedback — AI 답 평가

- 이슈: #236 (3.12) · 화면: W-03 ⑤ · 기획서 FS-9
- 답(`ANSWERED`)이 도움이 됐는지와 아니면 그 사유를 저장합니다. 질문 하나에 평가 하나이고, 다시 보내면 바꿉니다(마지막 값만 남음). 사용자 정보는 저장하지 않습니다.
- `ANSWERED`가 아닌 질문(`NOT_FOUND`·`OUT_OF_SCOPE`·`REVIEW_NEEDED`)은 평가할 답이 없어 400입니다.

**요청**

```json
{ "helpful": false, "reason": "WRONG_SOURCE" }
```

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| path | `analysisId` | number | 예 | 분석 ID |
| path | `questionId` | number | 예 | 질문 ID(이 분석의 질문) |
| body | `helpful` | boolean | 예 | 도움이 됐으면 true |
| body | `reason` | string \| null | 아니오 | `helpful`이 false일 때만. `WRONG_SOURCE`(근거가 안 맞아요), `NOT_ANSWERED`(질문에 답하지 않았어요), `HARD_TO_READ`(이해하기 어려워요), `OTHER`(기타). 사유 없이 false만 보내도 됩니다 |

**응답 200**

```json
{ "questionId": 7, "helpful": false, "reason": "WRONG_SOURCE", "updatedAt": "2026-10-25T09:30:00" }
```

- `updatedAt`: 평가를 저장한 시각(한국 시간).

**에러**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `helpful`이 없음(`errors[].field`=`helpful`), `reason`이 위 값이 아니거나 `helpful`이 true인데 `reason`이 있음(`errors[].field`=`reason`), 본문이 JSON이 아님 |
| 400 | `COMMON_INVALID_INPUT` | 답한(`ANSWERED`) 질문이 아님(`errors` 없음, `message`에 안내) |
| 404 | `ANALYSIS_NOT_FOUND` | 없는 분석 |
| 404 | `ANALYSIS_QUESTION_NOT_FOUND` | 없는 질문, 또는 이 분석의 질문이 아님 |

### GET /api/system/health — 연결 상태

- 이슈: #48 (0.5)

**응답 200**

```json
{ "backend": "UP", "aiServer": "UP" }
```

AI 서버가 응답하지 않으면 `aiServer`가 `DOWN`입니다(200 그대로).

### GET /api/system/ai-usage — AI 사용 현황

- 이슈: #245, #349 (0.7) · 화면: AI 사용 현황(`/system/ai-usage`) · 기획서 FS-15, FS-50
- 최근 `days`일 동안의 AI 질문 상태, 답 평가, 문장 풀이 상태, LLM 호출 수·토큰을 집계해 돌려줍니다. 집계만 돌려주고 질문 본문·답·사용자 정보는 넣지 않습니다. 인증은 없습니다(팀 결정 전까지).
- 기간은 한국 시간 날짜로 `to`(오늘)부터 거꾸로 `days`일(`from` = 오늘 − (`days` − 1)일)입니다. 질문·풀이는 `created_at`, LLM 호출은 `called_at`이 그 기간 안인 행을 셉니다(`called_at`이 null인 호출은 세지 않음). 평가는 그 기간에 한 질문의 평가입니다.
- 상태·결과·사유별 수는 기록이 없어도 아래 값을 모두 0으로 넣어 돌려줍니다. 비율은 코드가 계산하고, 분모가 0이면 null입니다(0과 구분).

**요청**

| 위치 | 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| query | `days` | number | 아니오 | `7` 또는 `30`. 기본 `30` |

**응답 200**

```json
{
  "days": 30,
  "from": "2026-09-26",
  "to": "2026-10-25",
  "questions": {
    "total": 12,
    "byStatus": { "ANSWERED": 8, "NOT_FOUND": 2, "OUT_OF_SCOPE": 1, "REVIEW_NEEDED": 1 }
  },
  "feedback": {
    "rated": 4, "helpful": 3, "notHelpful": 1, "helpfulRate": 0.75,
    "reasons": { "WRONG_SOURCE": 1, "NOT_ANSWERED": 0, "HARD_TO_READ": 0, "OTHER": 0 }
  },
  "explanations": {
    "total": 5,
    "byStatus": { "OK": 3, "REVIEW_NEEDED": 1, "NO_SOURCE": 1 }
  },
  "llmCalls": {
    "total": 15,
    "byOutcome": { "OK": 13, "INVALID_OUTPUT": 1, "TRANSIENT_ERROR": 0, "ERROR": 1 },
    "byTask": [
      { "task": "answer", "calls": 10, "inputTokens": 9000, "outputTokens": 1200 },
      { "task": "summary", "calls": 5, "inputTokens": null, "outputTokens": null }
    ],
    "byModel": [
      {
        "provider": "fake", "model": "fake-model", "calls": 5, "inputTokens": null, "outputTokens": null,
        "estimatedCostUsd": null,
        "byTask": [{ "task": "summary", "calls": 5, "inputTokens": null, "outputTokens": null }]
      },
      {
        "provider": "openai", "model": "gpt-6.1-sol", "calls": 10, "inputTokens": 9000, "outputTokens": 1200,
        "estimatedCostUsd": 0.03,
        "byTask": [{ "task": "answer", "calls": 10, "inputTokens": 9000, "outputTokens": 1200 }]
      }
    ],
    "perUnit": {
      "analysis": { "count": 2, "avgInputTokens": 4500, "avgOutputTokens": 600, "avgCostUsd": null },
      "briefing": { "count": 0, "avgInputTokens": null, "avgOutputTokens": null, "avgCostUsd": null }
    }
  }
}
```

- `questions.byStatus`: 질문 상태(`ANSWERED`·`NOT_FOUND`·`OUT_OF_SCOPE`·`REVIEW_NEEDED`, 위 질문 API와 같음)별 수. 분석 질문(`analysis_question`)과 기업 질문(`company_question`, #365)을 함께 셉니다. 평가(`feedback`)는 분석 질문에만 있습니다.
- `feedback`: `rated` 평가한 질문 수 = `helpful` + `notHelpful`. `helpfulRate` = `helpful` ÷ `rated`(소수 넷째 자리 반올림), `rated`가 0이면 null. `reasons`: 도움이 안 된 평가의 사유별 수(사유 없이 보낸 평가는 `notHelpful`에만 셈).
- `explanations.byStatus`: 문장 변경 한 줄 풀이 상태(`OK`·`REVIEW_NEEDED`·`NO_SOURCE`)별 수.
- `llmCalls`: 다시 만든 호출도 한 번씩 셉니다. `byOutcome`은 `OK`·`INVALID_OUTPUT`·`TRANSIENT_ERROR`·`ERROR`(그 밖의 값이 기록돼 있으면 그 값도 키로 들어감). `byTask`는 작업(`summary`, `answer`, `explanation` 등) 이름 순서이고 기록이 없으면 빈 배열입니다. `inputTokens`·`outputTokens`는 제공자가 알려 준 호출의 토큰 합이고, 그 작업의 호출이 모두 토큰을 모르면 null입니다.
- `llmCalls.byModel`: 제공자·모델(`llm_call.provider`·`model`)별 호출 수·토큰 합(#349, FS-50). 제공자, 모델 이름 순서이고 기록이 없으면 빈 배열입니다. 가짜 제공자(`fake`)와 실제 제공자(`openai` 등)를 따로 셉니다. `byTask`는 그 모델 안의 작업별 집계로 위 `byTask`와 같은 모양·순서입니다. 토큰이 null인 규칙도 위와 같습니다.
- `estimatedCostUsd`: 추정 비용(USD). backend 설정 `app.ai-usage.prices`(`제공자:모델` → 100만 토큰당 입력·출력 USD, 공식 가격 페이지 값)에 그 모델의 가격이 있을 때만 코드가 계산합니다: (입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가) ÷ 1,000,000, 소수 넷째 자리 반올림. 토큰을 모르는 호출은 0으로 더합니다. 가격 설정이 없거나(`fake` 포함) 입력·출력 토큰이 모두 null이면 null입니다(0과 구분). 가격은 추측해 넣지 않습니다.
- `llmCalls.perUnit`: 작업 단위 1건당 평균. `analysis`는 기간 안에 호출이 하나라도 있는 분석(`llm_call.analysis_id`가 같은 호출 묶음), `briefing`은 같은 기준의 기업 브리핑(`company_briefing_id`)입니다. 기간 밖의 호출은 넣지 않습니다. `count`는 그 단위 수, `avgInputTokens`·`avgOutputTokens`는 단위들의 토큰 합 ÷ `count`(정수로 반올림), `avgCostUsd`는 단위들의 추정 비용 합 ÷ `count`(소수 넷째 자리 반올림)입니다. `count`가 0이거나 토큰을 모두 모르면 평균은 null이고, 그 단위들의 호출 중 가격 설정이 없는 모델(`fake` 등)의 호출이 하나라도 있으면 `avgCostUsd`는 null입니다(일부만 더한 값을 비용처럼 보이지 않음).

**에러**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `days`가 7·30이 아니거나 숫자가 아님(`errors[].field`=`days`) |

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
| POST | `/internal/briefings` | AI 기업 브리핑(LLM) | #333 (1.2) | 초안 |

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
- 블록은 숫자를 가린 글로 자리를 맞춥니다(숫자만 바뀐 표도 같은 자리로). 맞춘 자리의 글이 숫자만 다르면 `NUMERIC_UPDATE`, 그 밖에 다르면 `MODIFIED`, 한쪽에만 있으면 `ADDED`·`DELETED`, 맞지 않는 구간은 글이 비슷한(0.5 이상) 블록끼리 수정(`MODIFIED`, 숫자만 다르면 `NUMERIC_UPDATE`)으로 짝짓습니다. 비슷한 정도(`similarity`)는 짧은 글(두 글 합 800자 이하)은 글자, 긴 글은 낱말 단위로 잽니다. 구간 하나에서 비교하는 횟수에 상한(300번)이 있어 넘으면 나머지는 `ADDED`·`DELETED`로 둡니다.
- 위치 이동(#150): 문서 전체의 `DELETED`·`ADDED` 중 블록 종류가 같고 숫자를 가린 글이 같거나 비슷한 정도가 0.95 이상이면서 다른 부분이 모두 띄어쓰기·문장부호뿐인 것을 한 쌍씩 `MOVED` 하나로 바꿉니다(같은 섹션 안에서 순서만 바뀐 것과 다른 섹션으로 옮긴 것 모두). 글자·낱말·기호나 숫자 자리가 하나라도 다르면(예: `(단위 : 주, %)` → `(단위 : 원, %)`) `DELETED`·`ADDED`로 남깁니다. 숫자를 가린 글이 20자보다 짧은 블록('해당사항 없음' 같은 글)은 짝짓지 않습니다. 같은 글을 먼저 짝짓고, 나머지는 이전 문서 순서대로 가장 비슷한 것(같으면 현재 문서 순서가 앞선 것)과 짝짓습니다. 비교 횟수에 상한(문서 하나에 20,000번)이 있어 넘으면 나머지는 `DELETED`·`ADDED`로 둡니다. `MOVED`의 `sectionStatus`·`sectionTitle`·`sectionPath`는 현재 쪽, `previousSectionPath`는 이전 쪽입니다.

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
  "diffVersion": "text-diff-2",
  "sectionCounts": { "matched": 118, "renamed": 1, "added": 2, "deleted": 1, "ambiguous": 0 },
  "changes": [
    {
      "changeType": "MODIFIED", "blockType": "PARAGRAPH", "sectionStatus": "MATCHED",
      "sectionTitle": "1. 사업의 개요", "sectionPath": "II. 사업의 내용 > 1. 사업의 개요",
      "previous": { "sectionNo": 3, "blockNo": 41 }, "current": { "sectionNo": 3, "blockNo": 44 },
      "previousSectionPath": null, "numbersOnly": false, "similarity": 0.6818, "reviewReason": null,
      "priority": { "level": "HIGH", "score": 60, "reasons": ["사업의 내용 섹션 +30", "수정 +10", "크게 바뀜(비슷한 정도 0.7 미만) +10", "문단 +10"] }
    }
  ]
}
```

- `numbersOnly`는 `NUMERIC_UPDATE`일 때만 true입니다. `previousSectionPath`는 `MOVED`일 때만 있고 그 밖은 null입니다.
- `priorityVersion`(응답 맨 위, 예: `priority-3`)은 우선순위 규칙 버전입니다. 각 변경의 `priority`는 확인할 순서를 정하는 점수와 적용한 규칙입니다(2.6, 5절의 잠정 규칙). `REVIEW_NEEDED`는 `UNRANKED`이고 점수가 없습니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 접수번호 형식이 틀림, 섹션 번호가 겹침, 없는 섹션을 가리키는 블록 |

### POST /internal/summaries — 근거 기반 요약·설명

- 이슈: #20 (3.2) · LLM은 `app/llm`의 한 모듈(0.7)로만 부릅니다.
- backend가 고른 항목과 그 근거 원문만 보냅니다. 사용자 정보는 넣지 않습니다. 원문은 프롬프트에서 `<disclosure id="…">` 태그로 감싸 자료로만 씁니다.
- LLM은 문장 변화마다 한 문장 요약(`sentence`)을 씁니다. 재무 수치마다 후보 원문이 그 변화를 어떻게 다루는지 등급(`grade`)을 매기고, 인용문(`quote`)과 인용 위치(`quoteEvidenceId`), 설명(`explanation`)을 씁니다([ADR-0015](adr/0015-explanation-grade-and-quote-check.md)). 후보 원문이 없는 재무 수치는 LLM에 묻지 않고 `grade: "NONE"`, 설명 없음(`explanation: null`)으로 돌려줍니다.

  | `grade` | 뜻 | `explanation` |
  | --- | --- | --- |
  | `STATED` | 회사가 변화의 원인을 직접 밝힘 | 회사가 밝힌 내용을 한 문장으로. 원인 표현(때문·로 인해 등)은 이 등급에만 씀 |
  | `RELATED` | 관련 내용은 있지만 원인을 말하지 않음 | "관련 공시 내용으로 ~이 있어요" 꼴. 원인 표현을 쓰지 않음 |
  | `NONE` | 확인된 설명 없음 | null(`quote`·`quoteEvidenceId`도 null, `evidenceIds`는 빈 배열) |
- 재무 수치의 `accountAliases`는 backend가 설명 후보를 찾을 때 쓴 검색어입니다. 계정명 정리 규칙과 표준계정 ID(`account_id`) 사전으로 만듭니다([ADR-0015](adr/0015-explanation-grade-and-quote-check.md)). 없으면 빈 배열입니다. ai-server는 인용 확인(#142)에 씁니다.
- 확인: 근거 ID가 그 항목에 보낸 원문 위치인지, 문장의 숫자와 크기 표현(두 배, 절반, 1조·500억처럼 단위가 붙은 수)이 인용한 원문에 그대로 있는지. 실패하면 문제를 알려 주며 2회까지 다시 만들고, 그래도 실패한 항목은 `REVIEW_NEEDED`입니다. 앞 응답에서 통과한 항목은 뒤 응답이 망가져도 그대로 씁니다. 근거 원문이 없는 문장 변화는 LLM에 묻지 않고 `REVIEW_NEEDED`입니다.
- 재무 설명의 등급은 코드가 낮추기만 하고 올리지 않습니다. 낮출 때는 다시 만들지 않고, `status`는 `OK`인 채로 낮춘 사유를 `reviewReason`에 남깁니다.
  - `quoteEvidenceId`가 그 항목에 보낸 후보 위치가 아니거나, 설명의 근거(`evidenceIds`)에 없거나, `quote`가 공백을 모두 뺀 뒤 그 문단에 그대로 없으면 `NONE`
  - `quote`에 `accountAliases`(비어 있으면 계정명)가 하나도 없으면 `RELATED`까지
  - LLM이 `NONE`이라고 하면서 설명을 쓰면 설명을 버리고 `NONE`
- 낮춘 뒤의 등급이 `STATED`가 아닌데 설명에 원인 표현(규칙 ID `CAUSAL_CLAIM`: 때문, 탓, 덕분, 로/으로 인해·인한, 에 기인, 영향으로, 영향을 받아, 결과로)이 있으면 문제를 알려 주며 다시 만들고, 2회 뒤에도 남으면 `REVIEW_NEEDED`입니다. 문장 변화 요약은 검사하지 않습니다.
- 회사·보고서·항목·계정 이름도 공시에서 온 자료라 `<context>`·`<item>` 태그의 속성에 넣습니다(지시와 섞이지 않게).

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
    { "ref": "F3", "accountName": "매출액", "direction": "UP", "accountAliases": ["매출액", "영업수익"],
      "candidates": [{ "evidenceId": "20260814001234#B812", "sectionPath": "IV. 이사의 경영진단 및 분석의견 > 2. 영업실적", "text": "…" }] }
  ]
}
```

**응답 200**

```json
{
  "promptVersion": "summary-2",
  "expressionRulesVersion": "expr-1",
  "gradeRulesVersion": "grade-2",
  "model": "fake-model",
  "generatedAt": "2026-10-21T14:07:12",
  "items": [
    { "ref": "T12", "kind": "TEXT", "status": "OK", "sentence": "…", "explanation": null,
      "grade": null, "quote": null, "quoteEvidenceId": null,
      "evidenceIds": ["20260814001234#B44"], "reviewReason": null, "blockedRules": [] },
    { "ref": "F3", "kind": "FINANCIAL", "status": "OK", "sentence": null, "explanation": "…",
      "grade": "STATED", "quote": "매출액은 메모리 수요 회복으로 전년 대비 증가하였습니다.",
      "quoteEvidenceId": "20260814001234#B812",
      "evidenceIds": ["20260814001234#B812"], "reviewReason": null, "blockedRules": [] },
    { "ref": "F4", "kind": "FINANCIAL", "status": "OK", "sentence": null, "explanation": null,
      "grade": "NONE", "quote": null, "quoteEvidenceId": null, "evidenceIds": [],
      "reviewReason": "인용문이 후보 원문에 없어 설명으로 쓰지 않았어요.", "blockedRules": [] }
  ],
  "calls": [
    { "task": "summary", "provider": "fake", "model": "fake-model", "promptVersion": "summary-2",
      "calledAt": "2026-10-21T14:07:11", "traceId": "…", "inputTokens": 1830, "outputTokens": 210,
      "latencyMs": 1420, "attempt": 1, "outcome": "OK", "error": null }
  ]
}
```

- `status`: `OK` 또는 `REVIEW_NEEDED`(`reviewReason`에 사유). 투자 권유성 표현 검사(5.5)에 걸려 내보내지 않은 항목은 `blockedRules`에 규칙 ID가 있고, 문장(`sentence`·`explanation`)은 null입니다. `expressionRulesVersion`(응답 맨 위, 예: `expr-1`)은 검사 규칙 버전입니다. `gradeRulesVersion`(예: `grade-2`)은 등급을 낮추는 규칙과 원인 표현 목록의 버전입니다. `calls`는 이 요청에서 LLM을 부른 기록(다시 만든 것 포함)이고 backend가 `llm_call`에 저장합니다.
- `grade`·`quote`·`quoteEvidenceId`: 문장 변화 항목과 `REVIEW_NEEDED`인 재무 항목은 null입니다. `reviewReason`이 있는 `OK` 재무 항목은 코드가 등급을 낮춘 경우입니다(화면에서 후보가 없던 `NONE`과 다른 사유 문구, #143).
- 시각은 한국 시간 `YYYY-MM-DDTHH:mm:ss`입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | `ref`가 겹침, 필드 누락 |
| 503 | `AI_LLM_UNAVAILABLE` | LLM을 쓸 수 없음 |

### POST /internal/answers — 근거로 답하기

- 이슈: #218 (3.10) · [ADR-0023](adr/0023-grounded-question-answering.md) · LLM은 `app/llm`의 한 모듈로만 부릅니다.
- 질문은 `<question>`, 원문은 `<disclosure id>`, 사실은 `<fact ref>` 태그로 감싸 자료로만 씁니다. 질문 안의 지시는 따르지 않습니다. 사용자 정보는 넣지 않습니다.
- `previousReport`는 선택입니다. 없으면(null) 보고서 하나에 대한 질문(기업 단위, #365)이고 `<context>`에 `previous` 속성을 넣지 않습니다. 이때 `sources[].side`는 모두 `current`, `facts`는 빈 배열입니다.
- 매수·매도·목표주가·주가 전망 질문(규칙 `OUT_OF_SCOPE_QUESTION`)은 LLM을 부르지 않고 `OUT_OF_SCOPE`, 후보(`sources`)와 사실(`facts`)이 모두 비었으면 LLM을 부르지 않고 `NOT_FOUND`입니다.
- LLM 출력: `{"status": "ANSWERED"|"NOT_FOUND", "answer": "…", "evidenceIds": […], "factRefs": […]}`. 답은 해요체 3문장·400자 이내, 문장마다 `[근거 ID]`나 `[F1]`을 붙여 쓰게 하고, ai-server가 근거 ID 표시를 그대로 둡니다(backend가 번호로 바꿈).
- 확인: `evidenceIds`·`factRefs`가 보낸 것이고 `ANSWERED`면 둘 중 하나 이상 있음, 답의 숫자·크기 표현이 인용한 원문·사실에 있음, 원인 표현(ADR-0015 `CAUSAL_CLAIM`)은 인용한 원문에도 원인 표현이 있을 때만, 표현 검사(5.5) 통과. 실패하면 문제를 알려 주며 2회까지 다시 만들고 끝내 실패하면 `REVIEW_NEEDED`(`answer` null, `reviewReason`)입니다. 표현 검사에 걸리면 `blockedRules`에 규칙 ID가 남습니다.

**요청**

```json
{
  "companyName": "삼성전자",
  "previousReport": "반기보고서 (2025.06)",
  "currentReport": "반기보고서 (2026.06)",
  "question": "매출액은 왜 늘었나요?",
  "facts": [{ "ref": "F1", "sentence": "매출액이 153.7조 원에서 305.4조 원으로 늘었어요(+98.7%)." }],
  "sources": [{ "evidenceId": "20260814003699#B812", "side": "current",
    "sectionPath": "IV. 이사의 경영진단 및 분석의견 > 2. 영업실적", "text": "…" }]
}
```

**응답 200**

```json
{
  "promptVersion": "answer-2",
  "expressionRulesVersion": "expr-1",
  "model": "fake-model",
  "generatedAt": "2026-10-24T10:12:03",
  "status": "ANSWERED",
  "answer": "회사는 메모리 수요 회복으로 매출이 늘었다고 밝혔어요[20260814003699#B812]. 매출액은 153.7조 원에서 305.4조 원으로 늘었어요[F1].",
  "evidenceIds": ["20260814003699#B812"],
  "factRefs": ["F1"],
  "reviewReason": null,
  "blockedRules": [],
  "calls": [{ "task": "answer", "provider": "fake", "model": "fake-model", "promptVersion": "answer-2",
    "calledAt": "2026-10-24T10:12:02", "traceId": "…", "inputTokens": 900, "outputTokens": 120,
    "latencyMs": 800, "attempt": 1, "outcome": "OK", "error": null }]
}
```

- `OUT_OF_SCOPE`·`NOT_FOUND`이면 `model`·`generatedAt`은 null, `calls`는 빈 배열입니다.

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 필드 누락, `evidenceId`·`ref` 겹침 |
| 503 | `AI_LLM_UNAVAILABLE` | LLM을 쓸 수 없음 |

### POST /internal/briefings — AI 기업 브리핑

- 이슈: #333 (1.2) · [ADR-0025](adr/0025-company-briefing.md) · LLM은 `app/llm`의 한 모듈로만 부릅니다.
- backend가 보고서 하나에서 고른 원문 블록(`sources`, 1~8개)만 보냅니다. 원문은 `<disclosure id topic sectionPath>` 태그로 감싸 자료로만 씁니다. 회사·보고서 이름은 `<context>` 태그 속성에 넣습니다. 사용자 정보는 넣지 않습니다.
- `promptVersion`은 backend가 기대하는 프롬프트 버전입니다. ai-server의 버전과 다르면 LLM을 부르지 않고 400입니다(backend `BriefingService.PROMPT_VERSION`과 ai-server `app/briefing/prompt.py`를 함께 바꿈).
- `topic`: `OVERVIEW` 사업 개요, `PRODUCTS` 주요 제품·서비스, `SALES` 매출, `RISK` 회사가 밝힌 위험.
- LLM 출력: `{"sentences": [{"text": "…", "evidenceIds": ["…"]}]}`. 해요체, 문장마다 120자 이내, 1~6문장.
- 확인: 문장마다 `evidenceIds`가 하나 이상이고 모두 보낸 근거 ID, 숫자·크기 표현이 그 문장이 인용한 원문에 있음, 원인 표현(`CAUSAL_CLAIM`)은 인용한 원문에도 원인 표현이 있을 때만, 표현 검사(5.5) 통과. 문장 안의 `[근거 ID]` 표시는 지우고 돌려줍니다. 하나라도 어기면 문제를 알려 주며 2회까지 다시 만들고, 끝내 실패하면 `REVIEW_NEEDED`(`sentences` 빈 배열, `reviewReason`)입니다. 표현 검사에 걸리면 `blockedRules`에 규칙 ID가 남습니다.

**요청**

```json
{
  "promptVersion": "briefing-1",
  "companyName": "삼성전자",
  "reportName": "사업보고서 (2025.12)",
  "sources": [{ "evidenceId": "20260310000123#B120", "topic": "OVERVIEW",
    "sectionPath": "II. 사업의 내용 > 1. 사업의 개요", "text": "…" }]
}
```

**응답 200**

```json
{
  "promptVersion": "briefing-1",
  "expressionRulesVersion": "expr-1",
  "model": "fake-model",
  "generatedAt": "2026-10-26T10:12:03",
  "status": "GENERATED",
  "sentences": [{ "text": "회사는 반도체와 스마트폰을 만들어 판다고 밝혔어요.", "evidenceIds": ["20260310000123#B120"] }],
  "reviewReason": null,
  "blockedRules": [],
  "calls": [{ "task": "briefing", "provider": "fake", "model": "fake-model", "promptVersion": "briefing-1",
    "calledAt": "2026-10-26T10:12:02", "traceId": "…", "inputTokens": 900, "outputTokens": 120,
    "latencyMs": 800, "attempt": 1, "outcome": "OK", "error": null }]
}
```

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `COMMON_INVALID_INPUT` | 필드 누락, `sources`가 비었거나 8개 초과, `evidenceId` 겹침, `topic`이 정한 값이 아님, `promptVersion`이 다름 |
| 503 | `AI_LLM_UNAVAILABLE` | LLM을 쓸 수 없음 |

## 4. 에러 코드

`code`는 `영역_내용` 형식의 대문자 스네이크입니다. 화면은 `code`를 보고 예외 상태를 고릅니다. 분석 작업이 실패한 사유(`GET /api/analyses/{analysisId}`의 `error.code`)는 HTTP 에러가 아니라서 이 표에 없고, 그 절의 표에 있습니다.

| code | 상태 | 뜻 | 화면 처리 |
| --- | --- | --- | --- |
| `COMMON_INVALID_INPUT` | 400 | 입력값이 형식에 맞지 않음 | 입력창 아래에 `errors[].reason` |
| `COMMON_EMAIL_ALREADY_EXISTS` | 409 | 이미 등록된 일반 가입 이메일(#136) | 이메일 입력 아래 중복 안내 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 이메일 또는 비밀번호가 맞지 않음 | 로그인 입력 확인 안내 |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | Refresh Token이 없거나 만료·폐기·변조됨 | 로그인 화면으로 이동 |
| `AUTH_UNAUTHORIZED` | 401 | Access Token이 없거나 유효하지 않음 | 재발급 또는 로그인 화면으로 이동 |
| `COMMON_NOT_FOUND` | 404 | 없는 경로 | 공통 오류 안내 |
| `COMMON_METHOD_NOT_ALLOWED` | 405 | 지원하지 않는 메서드 | 공통 오류 안내 |
| `COMMON_INTERNAL_ERROR` | 500 | 알 수 없는 서버 오류 | 공통 오류 안내와 추적 ID |
| `COMPANY_NOT_FOUND` | 404 | 없는 기업 | 검색으로 돌아가기 |
| `COMPANY_LIST_NOT_LOADED` | 503 | 기업 목록을 아직 받지 않음 | 관리자에게 기업 목록 갱신 요청 안내 |
| `COMPANY_DISCLOSURE_NOT_FOUND` | 404 | 이 기업의 최근 공시에 없거나 핵심 수치를 지원하지 않는 공시(FS-51) | 최근 공시 다시 불러오기 |
| `COMPANY_NOTE_NOT_FOUND` | 404 | 없는 노트 항목(또는 다른 회원의 항목, #413) | 노트 목록 다시 불러오기 |
| `REPORT_NOT_FOUND` | 404 | 없는 보고서 | 보고서 목록 다시 불러오기 |
| `REPORT_SECTION_NOT_FOUND` | 404 | 원문에 없는 항목 | 목차에서 다시 고르기 |
| `ANALYSIS_NOT_FOUND` | 404 | 없는 분석 | 처음부터 다시 |
| `ANALYSIS_NOT_COMPARABLE` | 422 | 비교할 수 없는 보고서 쌍 | W-01 ③ 사유와 다음 행동 |
| `ANALYSIS_NOT_READY` | 409 | 분석이 끝나지 않음 | W-02로 이동 |
| `ANALYSIS_CHANGE_NOT_FOUND` | 404 | 없는 계정 항목 | 목록 다시 불러오기 |
| `ANALYSIS_TEXT_CHANGE_NOT_FOUND` | 404 | 없는 문장 변경 항목 | 목록 다시 불러오기 |
| `ANALYSIS_QUESTION_NOT_FOUND` | 404 | 없는 질문(또는 이 분석의 질문이 아님) | 질문 기록 다시 불러오기 |
| `ANALYSIS_NOTIFICATION_NOT_FOUND` | 404 | 없는 알림(또는 다른 회원의 알림, #38) | 알림 목록 다시 불러오기 |
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
| 투자 권유성 금지 표현(5.5) | `expr-1`: 매수·매도 권유(`TRADE_RECOMMENDATION`: '매수하세요', '매수하는 것이 좋아요', '매도 의견', '매수 기회', '저점 매수', '비중 확대를 권해요' 등), 투자 권유(`INVESTMENT_ADVICE`: '투자를 고려해 볼 만한'), 목표주가(`TARGET_PRICE`), 주가 예측(`PRICE_FORECAST`: '주가가 오를', '주가 상승이 기대', '주가 전망', 상한가·하한가), 가치 판단(`VALUE_JUDGMENT`: 저평가·고평가, 투자 매력, 호재·악재, 수혜주 등), 수익 보장(`RETURN_GUARANTEE`: '원금이 보장돼요', '확실한 수익'). 공시에 흔한 사실(자기주식 매도, 해외 투자 비중 확대, 주가 변동 위험, 원금 보장형 상품, 수익 보장 약정, 경영 목표)은 막지 않도록 권유·예측의 꼴만 잡음. AI 문장에만 적용. 규칙은 `ai-server/app/compliance/expressions.py` | [투자 권유성 금지 표현 기준](https://app.notion.com/p/400b6afffc6f81bab915c86bdd8183aa) |
| 요약할 변화 고르기(3.2) | 재무 수치: 계산한 계정 중 손익계산서 증감액 상위 3개(손익계산서가 없으면 포괄손익계산서), 재무상태표 2개. 문장 변화: 우선순위 높음·중간 중 점수 상위 5개(숫자만 바뀜 `NUMERIC_UPDATE`·위치 이동 `MOVED`·검토 필요 제외). 설명 후보: 현재 보고서 '경영진단'·'사업의 내용' 섹션 문단 중 계정 이름이 나오는 앞의 2개(문단당 1,500자까지) | [공시 변화 평가 규칙과 중립·판단 유보 도입 여부](https://app.notion.com/p/400b6afffc6f8139ae35e8183960af19) |
| 변경 항목 우선순위 규칙(2.6) | 점수 합(`priority-3`): 섹션(사업의 내용 30, 경영진단·투자자 보호·우발·소송 25, 대주주·특수관계 20, 재무에 관한 사항 10, 그 밖 5) + 추가·삭제 20, 수정 10(비슷한 정도 0.7 미만이면 +10), 숫자만 바뀜 −20, 위치 이동 −20 + 문단 10 + 새로 들어간 낱말(추가는 현재 글, 삭제는 이전 글)의 핵심어(계속기업·소송·제재·합병 등, 계속기업을 먼저 셈, #145) 15씩 최대 2개. 60점 이상 높음, 30점 이상 중간. 검토 필요는 판단 유보 | [공시 변화 평가 규칙과 중립·판단 유보 도입 여부](https://app.notion.com/p/400b6afffc6f8139ae35e8183960af19) |
| 관련 수시공시 범위와 규칙(3.6) | #337·[ADR-0030](adr/0030-related-disclosure-matching.md): 문장 변경(`text_change`)에만 연결, 상세유형 `B001`·`I001`·`I002`, 제목 규칙 8개(`related-1`, 사전 조사 2장 수정안 반영), '내용 일치'는 DS005 3개 유형(신주 수·원고·사건 명칭·대상 회사). 재무 변경·실적 공시 연결, 자회사 공시 포함 여부는 미정 | [관련 수시공시 처리 범위와 표시 방식](https://app.notion.com/p/1a5f2f2c711282b98425019f69576d81) |
