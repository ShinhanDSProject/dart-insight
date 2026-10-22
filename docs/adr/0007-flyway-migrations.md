# ADR-0007: DB 스키마는 Flyway 마이그레이션으로만 바꾸고 JPA는 검증만 한다

- 상태: 채택
- 결정한 날: 2026-10-21
- 관련: [PR #43](https://github.com/ShinhanDSProject/dart-insight/pull/43), [PR #71](https://github.com/ShinhanDSProject/dart-insight/pull/71)(0.2), [PR #72](https://github.com/ShinhanDSProject/dart-insight/pull/72)(0.3), `docs/erd.md`, 노션 개발 기준 7장

## 맥락

- 여섯 명이 각자 로컬 MariaDB를 띄우고, CI도 DB를 새로 만듭니다. 스키마가 사람마다 달라지면 "내 PC에서는 된다"가 생깁니다.
- 스키마를 바꾸는 PR이 여러 개 동시에 열리고, 선행 PR 위에 쌓아 순서대로 병합합니다.
- 일부 표는 JPA 엔티티가 아니라 JDBC로 씁니다([ADR-0011](0011-jdbc-batch-for-large-tables.md)).

## 결정

- 스키마는 `backend/src/main/resources/db/migration/V{번호}__{설명}.sql`로만 바꿉니다. backend가 시작할 때 Flyway가 적용합니다.
- main에 병합된 마이그레이션 파일은 고치지 않고 새 파일을 더합니다.
- JPA `ddl-auto`는 `validate`로 둡니다. 엔티티와 스키마가 다르면 서버가 뜨지 않습니다.
- `docs/erd.md`를 같은 PR에서 고치고, 문서와 마이그레이션이 다르면 마이그레이션 파일이 기준입니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| `ddl-auto=update` | 바뀐 기록이 남지 않고, 컬럼 삭제·이름 변경을 하지 못하며 사람마다 스키마가 달라집니다. |
| Liquibase | 기능은 충분하지만 XML·YAML 형식을 배워야 합니다. 팀에 익숙한 SQL 파일 그대로가 검토하기 쉽습니다. |
| 수동으로 SQL을 실행하고 문서로 공유 | 누가 어디까지 적용했는지 알 수 없습니다. |

## 결과

- 좋아지는 점: 모든 PC와 CI가 같은 순서로 같은 스키마를 만듭니다. 스키마 변경이 PR에서 SQL로 검토됩니다.
- 감수하는 점: 동시에 열린 PR이 같은 번호를 쓰면 나중에 병합하는 쪽이 번호를 올려야 합니다. 병합된 파일의 실수도 새 파일로 고쳐야 합니다.
- 지켜야 할 것: JDBC로 쓰는 표는 `validate`가 컬럼을 검사하지 않으므로 저장·조회 테스트로 확인합니다.

## 다시 볼 때

- 운영 DB가 생겨 되돌리기(rollback) 절차가 필요할 때
