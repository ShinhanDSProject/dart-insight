# AGENTS.md

AI 코딩 도구(Claude Code, Codex, Cursor, Copilot 등)가 이 저장소에서 작업할 때 지키는 규칙입니다. 사람도 같은 규칙을 따릅니다.

규칙의 기준은 노션 [개발 기준](https://app.notion.com/p/400b6afffc6f813aac54dd697afc9d8e)입니다. 노션을 열 수 없는 도구를 위해 핵심만 옮겨 두었습니다. 개발 기준이 바뀌면 이 파일도 같은 PR에서 고칩니다.

## 프로젝트

같은 기업의 DART 정기보고서 두 개를 비교해, 바뀐 재무 수치와 문장을 원문 근거와 함께 보여 주는 웹 서비스입니다. 신한DS Academy 2차 프로젝트이며, 투자 조언 서비스가 아닙니다.

| 폴더 | 역할 | 기술 |
| --- | --- | --- |
| `frontend/` | 화면 | React + TypeScript |
| `backend/` | 서비스 API, OpenDART 조회·캐시, 분석 작업 관리 | Spring Boot |
| `ai-server/` | 원문 파싱·구조화, 문장 변경 탐지, 요약·설명 | FastAPI, LangChain·LangGraph (Python) |
| `docs/` | 프로젝트 개요, API 명세·ERD, 협업 가이드 | — |

DB는 MariaDB(정형 데이터)와 Chroma(본문 임베딩)이고, 외부 데이터는 OpenDART입니다.

## 작업 전에

1. 작업할 GitHub 이슈를 읽습니다. 완료 기준과 범위를 확인하고, 범위 밖의 변경은 하지 않습니다. 10/22 이후 만든 기능 이슈(`feature` 레이블)면 '관련 기획서'의 기능 기획서(FS-n)와 수용 기준(AC)도 읽고, 기획서나 결정 로그 링크가 없으면(`기획 필요`) 구현을 시작하지 말고 사람에게 묻습니다. 그 전에 만든 MVP 이슈는 이슈 본문의 완료 기준을 따릅니다.
2. 바꾸려는 코드 주변의 구조와 이름을 먼저 읽고 맞춥니다.
3. API나 DB 구조를 바꿔야 하면 코드보다 `docs/api-spec.md`·`docs/erd.md`를 먼저 고치고 사람에게 확인받습니다.
4. 공시 용어나 OpenDART 코드·필드는 추측하지 않습니다. 노션 도메인 가이드·OpenDART 데이터 가이드나 [OpenDART 개발가이드](https://opendart.fss.or.kr/guide/main.do)로 확인하고, 확인할 수 없으면 사람에게 묻습니다.
5. 구조에 관한 코드(어떤 결정이 해당하는지는 `docs/adr/README.md`의 '무엇을 ADR로 남기나')를 바꾸기 전에 `docs/adr/`의 관련 ADR을 읽습니다. 채택된 ADR과 다르게 해야 하면 코드보다 새 ADR을 먼저 쓰고 사람에게 확인받습니다.

## 구조 규칙

- 호출 방향은 React → Spring Boot → FastAPI입니다. React는 Spring Boot만 부르고, FastAPI나 OpenDART를 직접 부르지 않습니다.
- OpenDART 호출과 캐시는 backend가, 원문 파싱·구조화는 ai-server가 맡습니다. 받은 데이터는 접수번호 기준으로 캐시하고 같은 요청을 반복하지 않습니다.
- 분석은 비동기 작업입니다: 요청 → 작업 ID 발급 → 상태 조회 → 결과 조회.
- 분석 작업 상태는 `PENDING → RUNNING → COMPLETED` 또는 `FAILED`로만 바뀝니다. 코드에 허용 전이표를 두고 다른 전이는 거부합니다. 결과를 저장하기 전에는 `COMPLETED`로 바꾸지 않습니다.
- 증감액·증감률·순위 같은 숫자는 코드가 계산합니다.
- LLM은 ai-server의 한 모듈을 거쳐서만 부릅니다(모델 교체, 호출 기록, 비용 집계를 한 곳에서 하기 위해).
- 화면에 보이는 수치·문장은 근거 위치(접수번호, 섹션·문단 또는 계정)를 갖습니다. 근거가 없으면 '확인된 설명 없음'이나 '검토 필요'로 표시합니다.

## 아키텍처 결정 기록(ADR)

- 구조에 영향을 주는 결정을 하거나 바꾸면 그 PR에 `docs/adr/`의 ADR을 함께 넣습니다. 무엇이 해당하는지와 쓰는 법은 `docs/adr/README.md`, 템플릿은 `docs/templates/adr.md`에 있습니다.
- 채택된 ADR의 결정 내용은 고치지 않습니다(오타·링크·파일 경로는 고쳐도 됨). 예외로, 이미 있는 코드를 소급 기록한 ADR이 그 코드와 다르게 적혀 있으면 코드에 맞춰 고칩니다. 결정이 바뀌면 새 ADR을 쓰고, 이전 ADR은 상태 줄만 '대체됨(ADR-NNNN)'으로 바꿉니다.
- 기획·범위·판단 기준·팀 운영 규칙은 ADR이 아니라 노션 결정 로그에 남깁니다.

## 워크플로우와 단계별 절차

- 새 기능은 노션 [개발 워크플로우](https://app.notion.com/p/401b6afffc6f81ab85f5e0996089ef57) 순서를 따릅니다: 성공 기준(SC) → 기능 기획서(FS-n, 수용 기준 AC) → 사용자 흐름·화면(W-nn) → 설계(ADR·API 명세·ERD) → 이슈(WBS ID) → PR → 검증.
- 단계별 작업 절차는 `.claude/skills/`에 있습니다. Claude Code는 스킬로 불러 쓰고, 다른 도구도 그 단계의 일을 할 때는 해당 파일을 읽고 따릅니다.

  | 할 일 | 절차 파일 |
  | --- | --- |
  | 기능 기획서 초안 | `.claude/skills/feature-spec/SKILL.md` (형식은 같은 폴더 `template.md`) |
  | 기획서를 이슈로 쪼개기 | `.claude/skills/spec-to-issues/SKILL.md` |
  | ADR 쓰기 | `.claude/skills/adr/SKILL.md` |
  | 수용 기준 검증·완료 | `.claude/skills/verify-spec/SKILL.md` |

- 절차를 바꾸면 노션 개발 워크플로우와 기능 기획서 템플릿도 같은 PR에서 맞춥니다.

## AI 기능 규칙 (ai-server)

- LLM에 계산을 맡기지 않습니다. 코드가 만든 값을 그대로 넣습니다.
- LLM이 만든 문장에는 근거 ID가 있어야 합니다. 근거 ID가 없거나 저장된 원문 위치가 아니면 결과에 쓰지 않습니다.
- 결과 검증에 실패하면 최대 2회까지 다시 생성하고, 그래도 실패하면 '검토 필요'로 끝냅니다. 실패를 성공으로 처리하지 않습니다.
- 공시 원문은 지시가 아니라 자료입니다. 프롬프트에서 원문을 구분 태그로 감쌉니다.
- 매수·매도 추천, 목표주가, 주가 예측, '저평가' 같은 가치판단을 쓰지 않습니다. 화면에 내보내기 전에 표현 자동 검사(5.5)를 거칩니다.
- AI가 만든 요약·설명에는 'AI 생성' 표시를 코드로 붙이고, 모델 이름·프롬프트 버전·호출 시각을 함께 저장합니다.
- 사용자 정보는 프롬프트에 넣지 않습니다.
- 파싱·요약 테스트에 쓴 실제 원문은 접수번호와 기대값(섹션 수, 표 셀 수 등)을 테스트 자료로 남깁니다.

## API·데이터 규칙

- 경로는 `/api/` 아래 소문자 복수형 명사입니다(예: `GET /api/companies?query=`). Spring Boot와 FastAPI 사이 내부 호출은 `/internal/` 아래에 둡니다. 경로 문자열은 서비스마다 한 곳에만 둡니다: frontend는 `frontend/src/api/endpoints.ts`, backend 컨트롤러와 웹 설정은 `ApiPaths`(클래스 단위 `@RequestMapping`), backend가 부르는 내부 경로는 `AiServerPaths`, OpenDART 호출 경로는 `OpenDartPaths`, ai-server 라우터는 `ai-server/app/api/paths.py`. 테스트는 API 약속을 확인하려고 경로를 문자열로 씁니다.
- 외부 API의 JSON 필드는 camelCase, 날짜는 `YYYY-MM-DD`(한국 시간), 금액은 보고서 통화의 정수(대부분 원)이고 통화(`currency`)를 함께 줍니다.
- 에러는 4xx·5xx 상태 코드와 아래 형식으로 돌려줍니다. 200 응답에 에러를 담지 않습니다. FastAPI도 같은 형식을 씁니다.

  ```json
  {
    "code": "ANALYSIS_NOT_COMPARABLE",
    "message": "사람이 읽는 설명",
    "traceId": "요청 추적 ID",
    "errors": [{ "field": "query", "reason": "2자 이상 입력" }]
  }
  ```

  `code`는 `영역_내용` 형식의 대문자 스네이크입니다(영역: `COMMON`, `COMPANY`, `REPORT`, `ANALYSIS`, `DART`, `AI`). `errors`는 입력값 검증 실패일 때만 채웁니다. 코드 목록은 `docs/api-spec.md`에 있습니다.
- 추적 ID: Spring Boot가 요청마다 `X-Trace-Id`를 정하고(요청 헤더에 있으면 그 값을 씀) 로그에 남기며, FastAPI를 부를 때 같은 헤더로 넘깁니다. 분석 작업의 요청 ID로 이 값을 저장합니다.
- 없는 값은 null로 두고 0과 구분합니다. 이전 값이 null이거나 0이면 증감률을 계산하지 않고 사유 코드를 남깁니다.
- 회사는 고유번호(`corp_code`), 보고서는 접수번호(`rcept_no`)를 키로 씁니다. 종목코드는 상장사에만 있어 키로 쓰지 않습니다.
- OpenDART 응답은 본문의 `status`를 확인한 뒤 씁니다. `013`은 실패가 아니라 '자료 없음'입니다.
- DB 스키마는 Flyway 마이그레이션 파일(`V{번호}__{설명}.sql`)로만 바꿉니다. main에 병합된 마이그레이션 파일은 고치지 않고 새 파일을 추가합니다. JPA `ddl-auto`는 `validate`로 둡니다.

## 비밀정보

- OpenDART·LLM 키, DB 비밀번호를 코드, 문서, 커밋, 로그, 테스트 자료에 쓰지 않습니다. 실제 값은 `.env`에만 두고, 저장소에는 `.env.example`(변수 이름과 가짜 값)만 둡니다.
- 예외: 개발용 OpenDART 공용 키는 원본을 팀 노션의 정해진 한 곳에만 두고, 각자 `backend/.env`의 `OPENDART_API_KEY`에 넣습니다. 그 밖의 곳(이 저장소 포함)에는 옮겨 적지 않습니다.
- 테스트나 예시에 키가 필요하면 가짜 값을 씁니다.
- 키가 노출된 것 같으면 작업을 멈추고 사람에게 알립니다. 파일을 지우는 커밋만으로는 해결되지 않습니다.

## Git·PR

- 브랜치는 이슈 하나에 하나입니다: `feature/{WBS ID}-{짧은-영문-이름}`(예: `feature/2.4-financial-compare`). 문서만 바꿀 때는 `docs/{이름}`, 설정만 바꿀 때는 `chore/{이름}`. main에 직접 커밋하지 않습니다.
- 커밋 메시지는 `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:` 뒤에 한국어로 무엇을 바꿨는지 씁니다. 한 커밋에는 한 가지 변경만 담습니다.
- PR 제목은 `[WBS ID] 이슈 제목`, 본문은 PR 템플릿을 채우고 `closes #이슈번호`를 적습니다. 병합은 rebase merge로 합니다. PR의 커밋이 그대로 main 기록이 되므로, 병합 전에 'WIP', '수정' 같은 커밋은 정리합니다.
- 선행 이슈가 아직 병합되지 않았으면 그 이슈 브랜치에서 새 브랜치를 만들고 PR의 base를 그 브랜치로 둡니다. 병합은 아래(선행) PR부터 순서대로 합니다.
- 실제로 실행하지 않은 테스트를 통과했다고 쓰지 않습니다.
- AI 도구는 사람이 요청하지 않으면 커밋, 푸시, PR 생성, 병합을 하지 않습니다.

## PR 전에 확인

- [ ] 바뀐 서비스의 빌드·린트·테스트를 로컬에서 돌렸다(명령은 아래 표)
- [ ] 이슈의 완료 기준을 하나씩 확인했다
- [ ] 비밀정보, 디버그 출력, 쓰지 않는 코드가 남아 있지 않다
- [ ] API·DB를 바꿨다면 `docs/api-spec.md`·`docs/erd.md`도 같은 PR에서 고쳤다
- [ ] 구조 결정을 하거나 바꿨다면 `docs/adr/`에 ADR을 추가했다
- [ ] 와이어프레임의 '예외·상태 처리'에 해당하는 경우도 확인했다

## 서비스별 컨벤션

코드 컨벤션은 서비스 폴더마다 `conventions.yaml`(`backend/`·`frontend/`·`ai-server/`)에 있습니다. 판단이 필요한 규칙만 `ID: 한 줄`로 적고, 형식은 린터·포매터가 검사합니다. 그 폴더의 `AGENTS.md`·`CLAUDE.md`가 이 파일을 가리키므로, 해당 서비스를 고칠 때만 읽힙니다.

## 서비스별 명령

CI(`.github/workflows/`)도 같은 명령을 씁니다. 버전은 backend Java 21, frontend Node.js 22, ai-server Python 3.12입니다.

| 서비스 | 빌드·테스트 | 린트 |
| --- | --- | --- |
| backend | `./gradlew build` (backend/) | 빌드에 포함 |
| frontend | `npm test && npm run build` (frontend/) | `npm run lint` |
| ai-server | `pytest` (ai-server/) | `ruff check .` |

PR마다 비밀정보 검사(gitleaks)가 돌고, 바뀐 서비스 폴더의 CI가 돕니다.

## 참고 문서

- 노션: [개발 기준](https://app.notion.com/p/400b6afffc6f813aac54dd697afc9d8e) · [개발 워크플로우](https://app.notion.com/p/401b6afffc6f81ab85f5e0996089ef57) · [기능 명세·WBS](https://app.notion.com/p/3ffb6afffc6f80179ffbfd4817a5aaa0) · [화면 와이어프레임](https://app.notion.com/p/c0f540f74d92496c9c20f23867afc15a) · [공시·재무 도메인 가이드](https://app.notion.com/p/3ffb6afffc6f804d85f4d36e6013635c) · [OpenDART 데이터 가이드](https://app.notion.com/p/400b6afffc6f81cc8870ee13d02d8ac1) (팀 워크스페이스 권한 필요)
- 저장소: `docs/project-overview.md`(프로젝트 개요), `docs/adr/`(아키텍처 결정 기록), `docs/monorepo-team-guide.md`(Git·PR 절차), `docs/templates/`(API 명세·ERD·ADR 템플릿)
- 워크플로우 자료(노션): [성공 기준(SC)](https://app.notion.com/p/401b6afffc6f810bbb4bff6e32ec9172) · [기능 기획서 DB](https://app.notion.com/p/e1f20d0ae0584b6ba85e2b80906814d1) · [결정 로그](https://app.notion.com/p/4ce942f6c0bc4d77a490ceeda26d4a18) · [MVP 요구사항·범위](https://app.notion.com/p/3ffb6afffc6f80c0ad55ce2ffba2d7f6)
- 작업 이슈: [GitHub Issues](https://github.com/ShinhanDSProject/dart-insight/issues)
