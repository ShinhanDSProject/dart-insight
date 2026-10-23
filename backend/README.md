# backend (Spring Boot)

서비스 API, OpenDART 조회·캐시, 분석 작업 관리를 맡습니다. React는 이 서버만 부릅니다.

| 항목 | 값 |
| --- | --- |
| Java | 21 |
| Spring Boot | 4.1 |
| 빌드 도구 | Gradle 9.5 (저장소의 `gradlew` 사용) |
| 포트 | 8080 |

## 실행

먼저 PC에 MariaDB를 설치하고 `db/local-init.sql`로 DB와 계정을 한 번 만들어 둡니다([로컬 개발 환경](../docs/local-setup.md) 2장).

```bash
cd backend
cp .env.example .env      # 값 채우기 (커밋하지 않음)
./gradlew bootRun         # Windows: gradlew.bat bootRun
```

상태 확인: <http://localhost:8080/actuator/health> 가 `{"status":"UP"}`를 돌려주면 정상입니다.

`.env`는 실행할 때 `backend/` 폴더에서 읽습니다. IDE에서 실행할 때는 작업 디렉터리를 `backend/`로 맞춥니다.

## 테스트

```bash
./gradlew build           # 컴파일 + 테스트
./gradlew test            # 테스트만
```

## 폴더

```text
src/main/java/com/dartinsight/
  common/                        설정·에러·추적 ID·웹 설정
  {도메인}/                      company, report, analysis, comparison, financial, document, summary, dart, aiserver, system
    controller/                  REST 컨트롤러
    service/                     업무 로직·트랜잭션
    repository/                  JPA Repository·JdbcTemplate Store·파일 저장소
    domain/                      엔티티·enum·값 record
    dto/                         요청·응답 record
    client/                      외부 연동(OpenDART·ai-server)
    config/                      설정 record
src/main/resources/              설정(application.yml)·Flyway 마이그레이션
src/test/java/com/dartinsight/   테스트(같은 패키지에 둠), architecture/에 ArchUnit 규칙
```

계층 규칙은 `conventions.yaml`의 PKG-1·PKG-2, 결정 배경은 `docs/adr/0016-layered-packages-and-completion-guard.md`에 있습니다.
