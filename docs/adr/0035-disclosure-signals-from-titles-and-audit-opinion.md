# ADR-0035: 확인해 볼 공시는 저장된 최근 공시 목록의 제목 규칙과 사업보고서별 감사의견 API로 요청 때 만들고, 결과는 따로 저장하지 않는다

- 상태: 채택
- 결정한 날: 2026-10-27
- 관련: #411 (1.2, FS-55), ADR-0024(캐시), [api-spec `GET /api/companies/{corpCode}/disclosure-signals`](../api-spec.md), [erd `disclosure_audit_opinion`](../erd.md)

## 맥락

- FS-55는 최근 1년의 공시 가운데 최대주주 변경·유상증자·전환사채·신주인수권부사채·소송 제기·회생·상장 관련·감사인 변경·감사의견(적정이 아님)을 종류별 건수, 사실 문장, 원문 링크와 함께 보여 준다. 점수·등급은 만들지 않는다. 한 자료를 받지 못하면 그 종류만 '확인하지 못함'으로 보여 '없음'과 구분해야 한다.
- 최근 공시 타임라인(#332)이 이미 기업별 공시 목록(`company_disclosure`)을 받아 1시간 동안 저장하고, 제목 규칙(`DisclosureGroupRules`)으로 묶는다. 최대 365일까지 받는다.
- 감사인·감사의견은 공시 제목에 없다. OpenDART 개발가이드 DS002 2020009 '회계감사인의 명칭 및 감사의견'(`accnutAdtorNmNdAdtOpinion.json`)이 `corp_code`·`bsns_year`·`reprt_code`로 당기·전기·전전기 감사인(`adtor`)·감사의견(`adt_opinion`)을 준다. 2026-10-27 실제 호출로 `bsns_year`가 `제60기\n(당기)` 모양이고 감사의견이 `적정의견`·`의견거절`로 오는 것을 확인했다.
- 거래소 공시 '외부감사인선임ㆍ해임신고서'는 상장 외국법인 것만 실제 응답에 보였고, 국내 회사의 감사인 변경을 제목으로 알 방법은 찾지 못했다.

## 결정

- 확인해 볼 공시는 요청 때마다 만든다. 공시 목록은 `DisclosureService.timeline(corpCode, 365, null)`의 저장된 목록을 그대로 쓰고(새 캐시를 두지 않음), 종류는 `DisclosureSignalRules`의 제목 규칙으로 정한다. 계산 결과(종류·건수·문장)는 저장하지 않는다.
- 감사인 변경·감사의견은 목록에 있는 12월 결산 사업보고서마다 감사의견 API를 사업보고서 코드(11011)로 한 번 부르고, 사업보고서 접수번호마다 `disclosure_audit_opinion`에 저장한다(ADR-0024의 '보고서에 딸린 자료'). 자료가 있으면 다시 받지 않고, `NO_DATA`는 `app.disclosures.refresh-after`(1시간)가 지나면 한 번 더 받는다. 판정(당기·전기 감사인 비교, 당기 감사의견의 `한정`·`부적정`·`거절`)도 `DisclosureSignalRules`에 둔다.
- 실패는 자료 단위로 나눈다. 공시 목록을 받지 못하고 저장된 목록도 없으면 여덟 종류 모두 `UNAVAILABLE`, 감사의견 API만 실패하면 감사 두 종류만 `UNAVAILABLE`이다. 응답은 200이다.
- 코드: `disclosure/service/DisclosureSignalService`, `disclosure/domain/DisclosureSignalRules`·`DisclosureSignalKind`, `disclosure/repository/DisclosureAuditOpinionStore`, `dart/client/OpenDartClient.auditOpinions`.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 계산한 확인해 볼 공시를 기업별로 저장 | 공시 목록이 1시간마다 바뀌어 저장한 결과도 같이 낡는다. 제목 규칙 계산은 목록 몇천 건에도 가볍다 |
| 감사의견을 `report_key_fact`에 새 종류로 저장 | `report_key_fact`는 `report` 외래 키가 있어, 보고서 목록을 받지 않은 기업의 사업보고서를 저장할 수 없다 |
| 감사의견을 공시 제목('감사보고서제출' 등)으로 정하기 | 제목에 감사의견이 없다. 본문을 읽어야 하고, 원문 파싱은 ai-server의 일이다(ADR-0003) |
| 감사 두 종류를 빼기 | 개발가이드와 실제 응답으로 필드와 값을 확인할 수 있어 뺄 이유가 없다 |

## 결과

- 좋아지는 점: 공시 목록을 한 번 받으면 타임라인과 확인해 볼 공시가 같이 쓴다. 감사의견은 사업보고서마다 한 번만 부른다.
- 감수하는 점: 결산월이 12월이 아닌 회사는 사업연도를 정하지 않아 감사 두 종류가 `UNAVAILABLE`이다. 같은 일을 거래소 공시와 주요사항보고서로 두 번 내면 두 건으로 센다. 감사의견 `한정`·`부적정`은 실제 응답에서 아직 보지 못했다.
- 지켜야 할 것: 제목 규칙이나 감사 판정을 바꾸면 `DisclosureSignalRulesTest`와 api-spec의 규칙 표를 같은 PR에서 고친다. 문장은 코드가 만들고 평가하는 말을 넣지 않는다.

## 다시 볼 때

- 결정 로그의 '영역 이름과 신호 종류'(잠정)가 정해지거나 종류를 더할 때
- 결산월이 12월이 아닌 회사를 지원할 때(`ReportNameParser`)
