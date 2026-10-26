# 로컬 개발 환경

세 서비스를 띄우기 전에 PC에 MariaDB를 설치해 DB와 계정을 만들고, 키를 `.env`에 넣습니다. Docker는 쓰지 않습니다.

## 1. 준비물

| 도구 | 버전 | 확인 명령 |
| --- | --- | --- |
| MariaDB | 11.4 이상 | `mariadb --version` |
| Java | 21 | `java -version` |
| Node.js | 22 | `node -v` |
| Python | 3.12 | `python --version` |

## 2. DB 준비

처음 한 번만 합니다. PC에 MariaDB(또는 MySQL)가 이미 있으면 새로 설치하지 말고 2.2부터 합니다.

### 2.1 MariaDB 설치

**macOS (Homebrew)**

```bash
brew install mariadb
brew services start mariadb     # 지금 켜고, PC를 다시 켜도 자동으로 켜짐
```

**Windows**

1. [MariaDB 다운로드 페이지](https://mariadb.org/download/)에서 11.4 이상, MSI 설치 파일을 받습니다.
2. 설치 중에 root 비밀번호를 정합니다(2.2에서 한 번 씁니다). 'Install as service'는 켜 두고, 포트는 3306 그대로 둡니다.
3. 설치가 끝나면 MariaDB가 Windows 서비스로 켜져 있습니다.

### 2.2 DB와 계정 만들기

저장소 루트에서 실행합니다. `dart_insight` DB와 `dart` 계정(비밀번호 `change-me`)을 만들고, 여러 번 실행해도 괜찮습니다.

```bash
# macOS
sudo mariadb -e "source backend/db/local-init.sql"

# Windows: 시작 메뉴의 'Command Prompt (MariaDB ...)'를 열고 저장소 루트로 이동한 뒤
mariadb -u root -p -e "source backend/db/local-init.sql"
```

테이블은 만들지 않습니다. backend를 처음 실행하면 Flyway가 `backend/src/main/resources/db/migration`의 파일로 만듭니다.

| 항목 | 값 |
| --- | --- |
| 주소 | `localhost:3306`, DB `dart_insight` |
| 계정 | `dart` / `change-me` (로컬 전용) |

접속 정보는 `backend/.env.example`과 같아서, 값을 바꾸지 않았다면 `.env`도 그대로 쓰면 됩니다.

### 2.3 Chroma(벡터 DB)

따로 설치하거나 띄우지 않습니다. ai-server가 필요할 때 자기 폴더 안에 파일로 저장하는 방식으로 씁니다(4.2·2.5에서 확정).

### 2.4 포트가 겹칠 때

| 서비스 | 기본 포트 | 바꾸는 곳 | 함께 바꿀 값 |
| --- | --- | --- | --- |
| MariaDB | 3306 | 이미 있는 MariaDB·MySQL을 쓰면 바꿀 필요가 없습니다 | `backend/.env`의 `DB_URL` |
| ai-server | 8000 | 실행할 때 `--port` | `backend/.env`의 `AI_SERVER_URL` |
| backend | 8080 | `backend/.env`의 `SERVER_PORT` | `frontend/.env`의 `VITE_API_BASE_URL` |
| frontend | 5173 | `npm run dev -- --port 5174` | `backend/.env`의 `CORS_ALLOWED_ORIGINS` |

어떤 프로그램이 포트를 쓰는지는 macOS에서 `lsof -nP -iTCP:8080 -sTCP:LISTEN`, Windows에서 `netstat -ano | findstr :8080`으로 확인합니다.

### 2.5 처음부터 다시 만들기

테이블 구조가 꼬이거나 테스트 데이터를 지우고 싶을 때 씁니다. `dart_insight`의 모든 데이터가 지워집니다.

```bash
# macOS
sudo mariadb -e "DROP DATABASE dart_insight; source backend/db/local-init.sql"

# Windows
mariadb -u root -p -e "DROP DATABASE dart_insight; source backend/db/local-init.sql"
```

backend를 다시 실행하면 Flyway가 테이블을 다시 만들고, 기업 목록도 다시 받습니다.

## 3. 키 관리

- 개발할 때 쓰는 키(OpenDART, LLM, JWT, Google·Kakao·Naver 로그인)는 팀 공용 키를 씁니다. 값은 팀 노션 [공용 키 모음](https://app.notion.com/p/405b6afffc6f8147aa17d7326618e548) 한 페이지에 모여 있고(팀 워크스페이스 권한 필요), 거기서 가져와 표에 적힌 서비스 폴더의 `.env`에 넣습니다. 따로 가입·발급하지 않습니다. 파일별로 넣는 순서는 [로컬 실행 전 .env 설정](https://app.notion.com/p/401b6afffc6f812ea3a1f821893e50ad)에 있습니다.
- OpenDART 키는 `backend/.env`의 `OPENDART_API_KEY`에 넣습니다. 다른 이름(예: `DART_API_KEY`)으로 넣으면 backend가 읽지 못합니다. OpenDART는 backend만 부르므로 다른 서비스의 `.env`에는 넣지 않습니다.
- OpenDART 이용약관(제19조②)은 인증키를 제3자에게 이용하게 하지 못하게 합니다. 그래서 공용 키는 팀 개발용으로만 쓰고 팀 밖에 공유하지 않습니다. 공용 키로 정한 이유와 각자 발급으로 되돌릴 조건은 노션 결정 로그 '개발용 OpenDART 인증키 운영'에 있습니다.
- 다른 키도 `.env.example`에 적힌 변수 이름 그대로 그 서비스 폴더의 `.env`에만 넣습니다(LLM 키는 `ai-server/.env`의 `LLM_API_KEY`). `.env`는 `.gitignore`로 막혀 있어 커밋되지 않습니다.

  ```bash
  cp backend/.env.example backend/.env
  cp ai-server/.env.example ai-server/.env
  cp frontend/.env.example frontend/.env
  ```

- 키 값은 팀 노션 '공용 키 모음' 한 곳에만 둡니다. 코드, PR, 채팅, 스크린샷이나 다른 페이지에 옮겨 적지 않습니다. 시연 서버의 키는 개발용과 다른 값을 서버 환경변수에만 둡니다. 이 저장소는 공개 저장소입니다. PR마다 비밀정보 검사(gitleaks)가 돌지만, 커밋된 키는 기록에 남으므로 걸렸다면 바로 팀에 알리고 키를 폐기·재발급합니다.
- OpenDART는 하루 호출 한도가 있고(초과하면 020 코드, API 응답은 `DART_RATE_LIMITED`), 공용 키라 팀이 한도를 함께 씁니다. backend가 받은 자료를 DB에 저장해 같은 요청을 반복하지 않으니, 같은 기업·보고서를 일부러 되풀이해 받지 않습니다. 한도에 걸리면 팀 채널에 알립니다. LLM 키도 팀이 사용량과 비용을 함께 쓰므로 필요한 만큼만 호출합니다.

## 4. 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| backend가 `Connection refused`, `Socket fail to connect`로 멈춤 | MariaDB가 꺼져 있습니다. macOS는 `brew services start mariadb`, Windows는 '서비스' 앱에서 MariaDB를 시작합니다. |
| backend가 `Access denied for user 'dart'@'localhost'`로 멈춤 | 2.2의 스크립트를 실행하지 않았거나, `.env`의 `DB_PASSWORD`가 `change-me`와 다릅니다. 스크립트를 다시 실행해도 괜찮습니다. |
| backend가 `Unknown database 'dart_insight'`로 멈춤 | 2.2의 스크립트를 실행하지 않았습니다. |
| `sudo mariadb`가 `Access denied for user 'root'` | root 비밀번호를 정해 둔 경우입니다. `mariadb -u root -p -e "source backend/db/local-init.sql"`로 비밀번호를 넣어 실행합니다. |
| MariaDB 대신 MySQL을 쓰고 있음 | 대부분 동작하지만 팀 기준은 MariaDB입니다. 이상한 SQL 오류가 나면 MariaDB로 바꿉니다. |
| backend 실행 직후 `aiServer`가 `DOWN`, 또는 다른 서비스의 응답이 옴 | 8000을 다른 프로젝트가 쓰고 있을 수 있습니다. `curl localhost:8000/health`로 확인하고, ai-server를 다른 포트로 띄운 뒤 `AI_SERVER_URL`을 맞춥니다. |
| Flyway `checksum mismatch` | 이미 적용된 마이그레이션 파일을 고친 경우입니다. 파일을 되돌리고 새 마이그레이션을 추가합니다. 로컬 데이터만 문제라면 [처음부터 다시 만들기](#25-처음부터-다시-만들기)를 합니다. |

## 5. 루트에서 한 번에 실행

저장소 루트의 `package.json`이 세 서비스의 명령을 모아 둡니다. 실제 명령은 `scripts/run.js`가 OS에 맞춰 부릅니다(`gradlew`/`gradlew.bat`, `.venv/bin`/`.venv\Scripts`). 루트에는 설치할 의존성이 없어 `npm install` 없이 씁니다. 2장의 DB 준비는 먼저 해 둡니다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run setup` | 서비스마다 `.env`가 없으면 `.env.example`에서 만들고(이미 있으면 그대로 둠), frontend `npm ci`, ai-server `.venv` 생성과 `requirements*.txt` 설치 |
| `npm run dev` | 세 서비스를 함께 실행합니다. 출력 줄 앞에 `[backend]`·`[ai-server]`·`[frontend]`가 붙고, Ctrl+C를 누르거나 하나가 꺼지면 나머지도 함께 끕니다 |
| `npm run dev:backend` · `dev:ai` · `dev:frontend` | 서비스 하나만 실행 |
| `npm test` · `npm run lint` · `npm run build` | 세 서비스 모두에 실행(`test:backend`처럼 서비스 하나만도 가능). 하나가 실패해도 나머지를 마저 돌리고, 실패한 서비스를 끝에 모아 보여 줍니다 |
| `npm run check` | CI와 같은 검사: backend `./gradlew build`, ai-server `ruff check .`·`pytest`, frontend `lint`·`test`·`build` |

- 서비스 이름을 뒤에 붙여 고를 수도 있습니다: `npm run dev -- backend frontend`, `npm run setup -- ai`(`ai`는 `ai-server`의 줄임).
- ai-server 가상환경은 `python3`(Windows는 `python`)로 만듭니다. 그 명령이 3.12가 아니면 경로를 주세요: `PYTHON=python3.12 npm run setup -- ai`.
- `setup`이 만든 `.env`에는 가짜 키 값이 들어 있습니다. 3장대로 공용 키를 채웁니다.
