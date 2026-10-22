# ADR-0011: 원문 블록·문장 변경·요약처럼 행이 많은 표는 JdbcTemplate으로 저장한다

- 상태: 채택
- 결정한 날: 2026-10-22
- 관련: [PR #101](https://github.com/ShinhanDSProject/dart-insight/pull/101)(4.2), [PR #102](https://github.com/ShinhanDSProject/dart-insight/pull/102)(2.5), [PR #107](https://github.com/ShinhanDSProject/dart-insight/pull/107)(3.2), `DocumentStore`, `TextChangeStore`, `SummaryStore`

## 맥락

- 보고서 하나의 원문은 문단·표가 수천 개이고, 분석 하나의 문장 변경도 수천 건이 될 수 있습니다.
- JPA로 한 행씩 저장하면 INSERT가 수천 번 나가고, 영속성 컨텍스트가 엔티티를 모두 붙잡아 메모리를 씁니다. 키를 `AUTO_INCREMENT`(IDENTITY)로 만들어 Hibernate의 일괄 INSERT도 쓸 수 없습니다.
- 목록 화면은 이 표를 종류·우선순위로 걸러 페이지 단위로 읽습니다.

## 결정

- 원문 목차·블록(`DocumentStore`), 문장·표 변경(`TextChangeStore`), 요약 항목·LLM 호출 기록(`SummaryStore`)은 `JdbcTemplate`으로 일괄 저장하고 SQL로 조회합니다.
- 다시 저장할 때는 그 원문(또는 분석)의 행을 모두 지우고 다시 넣습니다. 부르는 쪽 트랜잭션 안에서 하므로 분석 완료와 함께 묶입니다([ADR-0004](0004-async-analysis-job.md)).
- 기업·보고서·분석처럼 행이 적고 상태가 바뀌는 데이터는 JPA 엔티티로 둡니다.
- 스키마는 다른 표와 똑같이 Flyway로 만듭니다([ADR-0007](0007-flyway-migrations.md)).

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| JPA `saveAll`과 `hibernate.jdbc.batch_size` | IDENTITY 키에서는 일괄 INSERT가 되지 않습니다. 시퀀스·테이블 생성기로 바꾸면 MariaDB 설정과 스키마가 복잡해집니다. |
| 원문 블록을 JSON 한 칸에 통째로 저장 | 근거 ID로 블록 하나를 찾거나, 변경 목록을 걸러 페이지로 읽기 어렵습니다. |

## 결과

- 좋아지는 점: 수천 행을 몇 번의 일괄 INSERT로 저장하고, 목록을 필요한 만큼만 읽습니다.
- 감수하는 점: SQL을 직접 쓰므로 컬럼 이름이 바뀌어도 컴파일 때 잡히지 않고, `ddl-auto=validate`도 이 표의 매핑을 검사하지 않습니다.
- 지켜야 할 것: 이 표의 컬럼을 바꾸면 저장·조회 테스트를 함께 고치고 돌립니다. 새 표도 행이 많을지 먼저 보고 방식을 고릅니다.

## 다시 볼 때

- 행 수가 적은 표인데 JDBC로 쓰고 있거나, 반대로 JPA 표가 커져 느려질 때
