# dart-insight

DART 정기보고서 두 개를 비교해, 바뀐 재무 수치와 문장을 원문 근거와 함께 보여 주는 공시 분석 웹 서비스입니다. 공시에 익숙하지 않은 사람도 로그인 없이 기업을 검색하고, 같은 기업의 두 정기보고서를 골라 무엇이 바뀌었는지 확인할 수 있게 합니다.

> 서비스 이름(Dart Insight 또는 공시레이더)은 아직 정하지 않았습니다. 기획·범위·결정 사항은 노션이 기준입니다. 아래 [문서 안내](#문서-안내)를 보세요.

## MVP 범위

**흐름:** 기업 검색 → 보고서 선택 → 비교 검증 → 분석 진행 → 결과(요약·재무 수치 변화·문장 변화) → 원문 확인

| 구분 | 내용 |
| --- | --- |
| MVP (P1) | 기업 검색, 정기보고서 목록·정정 여부, 비교 보고서 선택과 비교 가능성 검증, 재무 계정 비교, 본문·표 변경 탐지와 우선순위, 근거 기반 요약, 수치·문장 근거와 DART 원문 위치, 투자 권유성 표현 자동 검사 |
| 확장 1순위 | 인용 검증 → 감사 로그·Kill Switch → ML 이상 탐지 |
| 확장 (P2) | 로그인·즐겨찾기·신규 공시 알림, 검토·결재·게시, AI 비교 기준 추천, 섹션 필터, 문장 변경 이력 |
| 하지 않는 것 | 매수·매도 추천, 목표주가, 주가 예측 |

이슈별 목적과 완료 기준은 [GitHub Issues](https://github.com/ShinhanDSProject/dart-insight/issues)에 있습니다. 이슈는 GitHub에서만 관리합니다.

## 기술 스택과 폴더

| 폴더 | 역할 | 기술 |
| --- | --- | --- |
| `frontend/` | 웹 화면 | React + TypeScript |
| `backend/` | 서비스 API, OpenDART 조회·캐시, 분석 작업 관리 | Spring Boot |
| `ai-server/` | 원문 파싱·구조화, 문장 변경 탐지, 요약·설명 | FastAPI, LangChain·LangGraph (Python) |
| `docs/` | 프로젝트 개요·배경 조사, API 명세·ERD, 협업 가이드 | — |

- DB는 MariaDB(정형 데이터)와 Chroma(본문 임베딩)를 씁니다. 외부 데이터는 OpenDART입니다.
- 호출 방향은 React → Spring Boot → FastAPI입니다. React는 Spring Boot만 호출합니다.

## 로컬 실행

| 서비스 | 버전 | 포트 | 실행 | 자세히 |
| --- | --- | --- | --- | --- |
| backend | Java 21, Spring Boot 4.1 | 8080 | `./gradlew bootRun` | [backend/README.md](backend/README.md) |
| frontend | Node.js 22, Vite 7 | 5173 | `npm ci && npm run dev` | [frontend/README.md](frontend/README.md) |
| ai-server | Python 3.12, FastAPI | 8000 | `uvicorn app.main:app --reload --port 8000` | [ai-server/README.md](ai-server/README.md) |

먼저 저장소 루트에서 `docker compose up -d`로 MariaDB·Chroma를 띄우고, 각 폴더에서 `.env.example`을 `.env`로 복사해 값을 채운 뒤 실행합니다. `.env`는 커밋하지 않습니다. DB 초기화, 키 관리, 문제 해결은 [로컬 개발 환경](docs/local-setup.md)에 있습니다.

## 일정

| 날짜 | 마일스톤 |
| --- | --- |
| 10/23(금) | M0 기반: 세 서비스 로컬 실행, 원문 파싱 스파이크, ERD·API 초안 |
| 10/30(금) | M1 첫 연결: AI 없이 검색 → 목록 → 비교 검증 → 재무 비교 → 결과 화면 |
| 11/6(금) | M2 MVP 기능 완성: 문장 변경 탐지, AI 요약·근거, 표현 자동 검사 |
| 11/11(수) | 기능 동결 |
| 11/12(목) | 데모 데이터 고정 |
| 11/17(화) | M3 검증·발표: 개발 마감 |
| 11/18(수) | 발표 |

마일스톤별 이슈는 [GitHub Milestones](https://github.com/ShinhanDSProject/dart-insight/milestones)에서 봅니다.

## 문서 안내

| 문서 | 위치 | 내용 |
| --- | --- | --- |
| 프로젝트 허브 | [노션 · 2차 프로젝트](https://app.notion.com/p/3feb6afffc6f818b83e0f23db6591572) | 모든 기획 문서의 시작점 |
| 프로젝트 개요 | [노션 · 프로젝트 개요·문제 정의](https://app.notion.com/p/3ffb6afffc6f80418b8ac274f0d20e18) | 왜 이 프로젝트를 하는지, 문제 정의와 차별점 |
| 개발 기준 | [노션 · 개발 기준](https://app.notion.com/p/400b6afffc6f813aac54dd697afc9d8e) | 팀과 역할, 구조 원칙, 이슈 운영, 브랜치·PR, API·데이터 규약, AI 사용 규칙 |
| AI 도구 규칙 | [`AGENTS.md`](AGENTS.md) | AI 코딩 도구와 팀이 지키는 규칙 요약 (노션 개발 기준에서 옮김) |
| 이슈·마일스톤 | [GitHub Issues](https://github.com/ShinhanDSProject/dart-insight/issues) | 작업 이슈, 완료 기준, 진행 상태 |
| 기능 명세·WBS | [노션 · 기능 명세·WBS](https://app.notion.com/p/3ffb6afffc6f80179ffbfd4817a5aaa0) | 일정·범위, 결정 로그 |
| 화면 설계 | [노션 · 사용자 흐름·화면 와이어프레임](https://app.notion.com/p/c0f540f74d92496c9c20f23867afc15a) | 화면 W-01~W-03, 예외·상태 처리 |
| 공시 용어 | [노션 · 공시·재무 도메인 가이드](https://app.notion.com/p/3ffb6afffc6f804d85f4d36e6013635c) | 정기보고서, 재무제표, 비교 기준 |
| OpenDART | [노션 · OpenDART 데이터 가이드](https://app.notion.com/p/400b6afffc6f81cc8870ee13d02d8ac1) | API 코드와 응답 필드 |
| 프로젝트 개요 상세 | [`docs/project-overview.md`](docs/project-overview.md) | 노션 프로젝트 개요의 10/14 초안과 근거 |
| 배경 조사 | [`docs/project-background-research.md`](docs/project-background-research.md) | 유사 서비스, OpenDART, LLM 기법, 규제 조사 |
| ERD | [`docs/erd.md`](docs/erd.md) | 테이블과 관계. 스키마를 바꾸는 PR에서 함께 고침 |
| API 명세 | [`docs/api-spec.md`](docs/api-spec.md) | 외부·내부 API, 에러 코드. API를 바꾸는 PR에서 함께 고침 |
| 협업 가이드 | [`docs/monorepo-team-guide.md`](docs/monorepo-team-guide.md) | Git·브랜치·PR 절차 |

노션 페이지는 팀 워크스페이스 권한이 있어야 열립니다.

## 협업 규칙 요약

- 이슈 하나에 브랜치 하나: `feature/{이슈ID}-{짧은-영문-이름}` (예: `feature/2.4-financial-compare`), 문서만 바꿀 때는 `docs/{이름}`, 설정만 바꿀 때는 `chore/{이름}`
- PR 제목은 `[WBS ID] 이슈 제목`, 본문은 [PR 템플릿](.github/pull_request_template.md)을 채우고 `closes #이슈번호`를 적습니다. 새 이슈는 '작업 이슈' 템플릿으로 만듭니다.
- `main`은 PR로만 바꾸고, rebase merge로 병합합니다. PR의 커밋이 그대로 main 기록이 되므로 커밋 메시지 규칙을 지킵니다. 선행 이슈 PR 위에 쌓인 PR은 아래(선행) PR부터 순서대로 병합합니다.
- PR마다 비밀정보 검사(gitleaks)가 돌고, 바뀐 서비스 폴더의 빌드·린트·테스트가 자동으로 돕니다.
- API나 DB 구조를 바꾸면 `docs/api-spec.md`·`docs/erd.md`도 같은 PR에서 고칩니다. DB 스키마는 Flyway 마이그레이션으로만 바꿉니다.
- AI 코딩 도구를 쓸 때는 [`AGENTS.md`](AGENTS.md)를 읽게 합니다. Claude Code는 `CLAUDE.md`를 통해 자동으로 읽습니다.
- API 키와 `.env`는 커밋하지 않습니다. 저장소에는 `.env.example`만 둡니다. OpenDART 키는 각자 발급받아 자기 `.env`에 넣습니다.

자세한 내용은 노션의 개발 기준과 [협업 가이드](docs/monorepo-team-guide.md)를 따릅니다.
