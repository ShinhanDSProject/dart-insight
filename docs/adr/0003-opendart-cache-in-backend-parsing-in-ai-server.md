# ADR-0003: OpenDART 호출·캐시는 backend가, 원문 파싱·구조화는 ai-server가 맡는다

- 상태: 채택
- 결정한 날: 2026-10-21
- 관련: [PR #76](https://github.com/ShinhanDSProject/dart-insight/pull/76)(4.4), [PR #78](https://github.com/ShinhanDSProject/dart-insight/pull/78)(4.1), [PR #83](https://github.com/ShinhanDSProject/dart-insight/pull/83)(4.5), [PR #101](https://github.com/ShinhanDSProject/dart-insight/pull/101)(4.2), 노션 OpenDART 데이터 가이드

## 맥락

- OpenDART는 하루 호출 한도가 있고, 넘으면 `020`을 돌려줍니다. 개발용 키는 팀이 함께 씁니다(노션 결정 로그 '개발용 OpenDART 인증키 운영').
- 공시서류원본파일(`document.xml`)은 보고서마다 본문과 첨부 서류가 든 ZIP이고, 사업보고서 본문에는 문단·표가 수천 개 들어 있습니다.
- 원문 XML은 형식이 엄격하지 않아(이스케이프 안 된 `&`, 닫히지 않은 태그) 엄격한 XML 파서는 내용을 버립니다. 관대한 파서와 문서 처리 도구는 Python 쪽이 낫고, 원문 처리 규칙은 AI 담당이 관리합니다.
- 응답의 HTTP 상태가 200이어도 본문 `status`가 오류일 수 있고, `013`은 오류가 아니라 '자료 없음'입니다.

## 결정

- OpenDART를 부르는 곳은 backend의 `OpenDartClient` 하나입니다. 인증키는 요청 주소에만 넣고 로그에서는 가립니다. 본문 `status`를 먼저 확인해 정해진 에러 코드로 바꿉니다(`020` → `DART_RATE_LIMITED`, `013`·`014` → 자료 없음).
- 받은 자료는 저장해 두고 같은 요청을 다시 보내지 않습니다.
  - 기업 고유번호 목록: DB. 서버를 시작할 때 비어 있을 때만 받습니다(`OPENDART_CORP_CODE_SYNC`).
  - 기업별 정기보고서 목록: DB. 저장한 지 `refresh-after`(기본 24시간)가 지나야 다시 받고, 다시 받다 실패하면 저장된 목록을 씁니다.
  - 재무제표: DB. 기업·사업연도·보고서 코드·연결/별도 기준별로 저장하고 `013`도 결과로 저장합니다. 정정 공시로 다른 접수번호의 값이 저장돼 있을 때만 정해진 때에 한 번 더 받습니다.
  - 원문 ZIP: 디스크. 접수번호별 파일로 둡니다(`DOCUMENT_CACHE_DIR`, `DocumentFileCache`).
- 원문 구조화는 ai-server가 합니다. backend가 원문 ZIP을 `/internal/` 호출로 넘기면 ai-server가 목차·문단·표로 나눠 돌려주고, backend가 그 결과를 접수번호 기준으로 DB에 저장합니다. 구조화 형식은 [ADR-0009](0009-document-structure-and-evidence-id.md)에 있습니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| ai-server도 OpenDART를 직접 부르기 | 키·한도·캐시를 두 곳에서 관리하게 되고, 같은 원문을 두 번 받을 수 있습니다. |
| backend(Java)에서 원문까지 파싱하기 | 엄격한 XML 파서가 깨진 원문의 내용을 버리고, 원문 처리 규칙을 AI 담당이 고치기 어렵습니다. |
| 캐시 없이 요청마다 OpenDART를 부르기 | 분석 한 번에 목록·재무제표·원문을 여러 번 받아 한도에 금방 닿습니다. |
| 원문 ZIP도 DB에 저장하기 | 큰 바이너리가 DB를 키우고 백업·초기화가 느려집니다. 구조화한 결과만 DB에 둡니다. |

## 결과

- 좋아지는 점: 키와 호출 한도를 한곳에서 관리합니다. 한 번 받은 원문과 재무제표는 다시 받지 않습니다. OpenDART가 실패해도 저장된 자료로 화면을 보여 줄 수 있습니다.
- 감수하는 점: 큰 ZIP을 내부 호출로 넘깁니다(압축을 푼 본문 파일이 300MB를 넘으면 ai-server가 구조화를 `FILE_TOO_LARGE` 실패로 끝냄). 디스크 캐시 폴더를 서버마다 관리해야 합니다.
- 지켜야 할 것: OpenDART 응답은 본문 `status`를 확인한 뒤 씁니다. 새 OpenDART API를 쓸 때도 저장 기준(무엇을 키로, 언제 다시 받는지)을 먼저 정합니다.

## 다시 볼 때

- 호출 한도 초과(`020`)가 자주 나올 때
- 서버를 여러 대로 늘려 디스크 캐시를 나눠 써야 할 때
