# backend (Spring Boot)

서비스 API, OpenDART 조회·캐시, 분석 작업 관리를 맡습니다. React는 이 서버만 부릅니다.

| 항목 | 값 |
| --- | --- |
| Java | 21 |
| Spring Boot | 4.1 |
| 빌드 도구 | Gradle 9.5 (저장소의 `gradlew` 사용) |
| 포트 | 8080 |

## 실행

DB가 필요한 기능은 먼저 저장소 루트에서 `docker compose up -d`로 MariaDB를 띄웁니다([로컬 개발 환경](../docs/local-setup.md)).

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
src/main/java/com/dartinsight/   애플리케이션 코드 (도메인별 패키지)
src/main/resources/              설정(application.yml)
src/test/java/com/dartinsight/   테스트
```
