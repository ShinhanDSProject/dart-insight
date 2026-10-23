# ADR-0017: 모든 테이블의 기본키는 자동 증가 id로 두고, OpenDART 키는 UNIQUE로 남긴다

- 상태: 채택
- 결정한 날: 2026-10-23
- 관련: 이슈 [#187](https://github.com/ShinhanDSProject/dart-insight/issues/187), [ADR-0006](0006-keys-amounts-and-null.md), [ADR-0007](0007-flyway-migrations.md), [ADR-0011](0011-jdbc-batch-for-large-tables.md), `docs/erd.md`, `backend/conventions.yaml` EN-5

## 맥락

- 테이블 12개 가운데 `company`(기본키 `corp_code`)와 `report`(기본키 `rcept_no`)만 OpenDART가 준 값을 기본키로 썼고, 나머지 10개는 `id BIGINT AUTO_INCREMENT`를 씁니다. 두 엔티티만 `Persistable`로 새 엔티티 여부를 직접 알려야 했고, Repository 키 타입도 `String`과 `Long`으로 갈렸습니다.
- 팀이 "모든 테이블에 자동 증가 `id`를 둔다"를 기본 규칙으로 정하자고 요청했습니다.
- 고유번호·접수번호로 회사·보고서를 가리키는 규칙([ADR-0006](0006-keys-amounts-and-null.md))은 API·캐시·근거 ID(`{rcept_no}#B{block_no}`)·다른 테이블의 외래 키가 이미 따르고 있습니다.
- 기업 목록(10만 건 넘음)은 키를 직접 정해 JPA 일괄 INSERT를 썼습니다([ADR-0011](0011-jdbc-batch-for-large-tables.md)). 키가 IDENTITY가 되면 Hibernate 일괄 INSERT가 꺼집니다.

## 결정

- 모든 테이블의 기본키는 `id BIGINT NOT NULL AUTO_INCREMENT` 컬럼 하나입니다. 엔티티는 `@GeneratedValue(strategy = GenerationType.IDENTITY) Long id`로 둡니다.
- OpenDART에서 받은 키는 기본키로 쓰지 않고 UNIQUE로 둡니다(`uk_company_corp_code`, `uk_report_rcept_no`). 회사·보고서를 가리키는 값은 ADR-0006대로 고유번호·접수번호이고, 다른 테이블의 외래 키와 API도 지금처럼 이 값을 씁니다. 조회는 `findByCorpCode`·`findByRceptNo`로 합니다.
- 기존 DB는 `V10__add_company_report_id.sql`이 바꿉니다(참조 외래 키를 내리고, 기본키를 바꾸고, UNIQUE 키에 다시 겁니다). 이미 있는 행에도 `id`가 채워집니다.
- 기업 목록 새로 넣기는 `CompanyStore`(JdbcTemplate 일괄 저장)로 합니다. 이미 있는 기업을 고치는 것은 엔티티로 합니다.
- `SchemaRuleTest`가 Flyway가 만든 스키마를 읽어 모든 테이블(`flyway_schema_history` 제외)의 기본키가 자동 증가 BIGINT `id`인지 검사합니다. `./gradlew build`에서 H2·MariaDB 모두 돕니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 외래 키도 `id`로 바꾸기(`report.company_id`, `analysis.current_report_id` 등) | 데이터 이관 SQL, JDBC Store, 테스트를 많이 고쳐야 합니다. 회사·보고서는 어디서나 고유번호·접수번호로 가리키므로 조인 한 번이 더 생길 뿐 얻는 것이 적습니다. |
| 새 테이블에만 규칙을 적용하고 `company`·`report`는 예외로 두기 | 예외가 남으면 규칙을 검사로 강제할 수 없고, 엔티티·Repository 모양이 계속 두 가지로 갈립니다. |
| `id` 컬럼만 더하고 엔티티는 자연키를 `@Id`로 두기 | DB 기본키와 JPA 식별자가 달라 `findById`·영속성 컨텍스트 동작을 잘못 읽기 쉽습니다. |

## 결과

- 좋아지는 점: 모든 엔티티·Repository가 같은 모양(`Long id`)이 되고, 규칙을 테스트가 강제합니다. 외부 키 형식이 바뀌어도 기본키는 영향을 받지 않습니다.
- 감수하는 점: `company`·`report`에 인덱스가 하나씩 늘어납니다(UNIQUE). 기업 목록 INSERT는 SQL을 직접 쓰므로 컬럼이 바뀌면 `CompanyStore`도 고쳐야 합니다.
- 지켜야 할 것: 새 테이블은 `id`를 기본키로 둡니다. 외부에서 받은 키는 UNIQUE로 두고, 행이 많아 일괄 INSERT가 필요하면 ADR-0011대로 JdbcTemplate Store를 씁니다.

## 다시 볼 때

- 외래 키를 `id` 참조로 옮겨야 할 이유가 생길 때(예: 고유번호·접수번호 형식이 바뀜)
