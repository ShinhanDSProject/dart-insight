# 로컬 개발 환경

세 서비스를 띄우기 전에 DB(MariaDB, Chroma)를 Docker로 띄우고, 키를 `.env`에 넣습니다.

## 1. 준비물

| 도구 | 버전 | 확인 명령 |
| --- | --- | --- |
| Docker Desktop (또는 Docker Engine + Compose) | Compose v2 | `docker compose version` |
| Java | 21 | `java -version` |
| Node.js | 22 | `node -v` |
| Python | 3.12 | `python --version` |

## 2. DB 띄우기

저장소 루트에서 실행합니다.

```bash
docker compose up -d        # MariaDB(3306), Chroma(8001) 실행. 포트가 겹치면 아래 '포트가 겹칠 때'
docker compose ps           # 상태 확인. mariadb가 healthy면 준비 완료
docker compose down         # 중지 (데이터는 남음)
```

| 서비스 | 주소 | 계정 |
| --- | --- | --- |
| MariaDB | `localhost:3306`, DB `dart_insight` | `dart` / `change-me` (로컬 전용) |
| Chroma | `http://localhost:8001` | 없음 |

접속 정보는 `backend/.env.example`, `ai-server/.env.example`과 같습니다.

### 포트가 겹칠 때

PC에 MariaDB·MySQL이 이미 설치돼 있거나 다른 프로젝트가 같은 포트를 쓰면, `compose.yaml`은 고치지 말고 포트만 환경변수로 바꿉니다. `compose.yaml`은 커밋되는 파일이라 각자 고치면 실수로 올라갈 수 있습니다.

```bash
lsof -nP -iTCP:3306 -sTCP:LISTEN          # 3306을 누가 쓰는지 확인 (macOS·Linux)
MARIADB_HOST_PORT=3317 docker compose up -d
```

매번 적기 번거로우면 저장소 루트에 `.env`를 만들어 `MARIADB_HOST_PORT=3317`처럼 적어 둡니다. 이 파일도 `.gitignore`로 막혀 있습니다.

| 바꾸는 포트 | 환경변수(기본값) | 함께 바꿀 값 |
| --- | --- | --- |
| MariaDB | `MARIADB_HOST_PORT` (3306) | `backend/.env`의 `DB_URL` (예: `jdbc:mariadb://localhost:3317/dart_insight`) |
| Chroma | `CHROMA_HOST_PORT` (8001) | `ai-server/.env`의 `CHROMA_URL` |
| ai-server | 실행할 때 `--port` (8000) | `backend/.env`의 `AI_SERVER_URL` |
| backend | `backend/.env`의 `SERVER_PORT` (8080) | `frontend/.env`의 `VITE_API_BASE_URL`, 화면 주소가 바뀌면 `CORS_ALLOWED_ORIGINS` |

### 처음부터 다시 만들기

테이블 구조가 꼬이거나 테스트 데이터를 지우고 싶을 때 씁니다. DB의 모든 데이터가 지워집니다.

```bash
docker compose down -v      # 컨테이너와 데이터(볼륨) 삭제
docker compose up -d        # 빈 DB로 다시 시작
```

backend를 다시 실행하면 Flyway가 `backend/src/main/resources/db/migration`의 마이그레이션으로 테이블을 다시 만듭니다.

## 3. 키 관리

- OpenDART 인증키는 각자 [OpenDART](https://opendart.fss.or.kr)에서 발급받습니다. 이용약관상 다른 사람과 공유할 수 없습니다.
- 키는 각 서비스 폴더의 `.env`에만 넣습니다. `.env`는 `.gitignore`로 막혀 있어 커밋되지 않습니다.

  ```bash
  cp backend/.env.example backend/.env
  cp ai-server/.env.example ai-server/.env
  cp frontend/.env.example frontend/.env
  ```

- 키를 코드, 노션, PR, 채팅, 스크린샷에 올리지 않습니다. PR마다 비밀정보 검사(gitleaks)가 돌지만, 커밋된 키는 기록에 남으므로 걸렸다면 바로 폐기·재발급합니다.
- OpenDART는 하루 호출 한도가 있습니다(초과하면 020 코드). backend가 받은 자료를 DB에 저장해 같은 요청을 반복하지 않습니다.

## 4. 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| `port is already allocated` (3306) | 이미 설치된 MariaDB·MySQL이나 다른 컨테이너가 3306을 쓰고 있습니다. 끄거나 [포트가 겹칠 때](#포트가-겹칠-때)처럼 `MARIADB_HOST_PORT`를 바꾸고 `DB_URL`도 맞춥니다. |
| backend가 `Access denied for user 'dart'@'localhost'`로 멈춤 | 컨테이너는 정상으로 떴는데 PC에 설치된 MariaDB·MySQL에 붙은 경우입니다. macOS에서는 포트가 겹쳐도 에러 없이 둘 다 뜰 수 있습니다. `lsof -nP -iTCP:3306 -sTCP:LISTEN`에 `mariadbd`·`mysqld`가 보이면 그 DB를 끄거나 [포트를 바꿉니다](#포트가-겹칠-때). |
| backend 실행 직후 `aiServer`가 `DOWN`, 또는 다른 서비스의 응답이 옴 | 8000을 다른 프로젝트가 쓰고 있을 수 있습니다. `curl localhost:8000/health`로 확인하고, ai-server를 다른 포트로 띄운 뒤 `AI_SERVER_URL`을 맞춥니다. |
| backend가 DB 연결 오류(`Socket fail to connect`, `Connection refused`)로 멈춤 | `docker compose ps`에서 mariadb가 healthy인지 확인합니다. |
| Flyway `checksum mismatch` | 이미 적용된 마이그레이션 파일을 고친 경우입니다. 파일을 되돌리고 새 마이그레이션을 추가합니다. 로컬 데이터만 문제라면 `docker compose down -v` 후 다시 시작합니다. |
