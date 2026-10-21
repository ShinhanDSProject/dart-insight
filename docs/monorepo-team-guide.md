# dart-insight 모노레포 설정 및 팀 협업 가이드

대상 저장소: [ShinhanDSProject/dart-insight](https://github.com/ShinhanDSProject/dart-insight)  
작성 기준: 2026년 10월 19일  
대상 독자: Git과 GitHub 협업을 처음 시작하는 팀원

> 이 문서는 지금까지 완료한 설정과 앞으로 사용할 협업 절차를 구분한다. 저장소에 올릴 위치는 `docs/monorepo-team-guide.md`를 권장한다. 현재는 공유·검토용 문서이며, 문서 작성만으로 저장소 설정이나 프로그램 설치가 이루어지지는 않는다.

## 1. 지금까지 무엇을 했나요?

| 항목 | 상태 | 설명 |
| --- | --- | --- |
| GitHub 저장소 생성 | 완료 | `ShinhanDSProject/dart-insight` |
| 모노레포 기본 폴더 구성 및 Push | 완료 | `backend/`, `frontend/`, `ai-server/`, `docs/` |
| `main` 브랜치 생성 | 완료 | 기본 브랜치는 `main` |
| `protect-main` Ruleset | 활성화 확인 | `main`에 적용 |
| 팀원 Write 권한 설정 | 사용자 완료 안내 기준 | 개별 팀원 초대 수락 여부는 각자 확인 |
| PR 작성자가 직접 병합 | 팀 운영 방식 | 병합 가능한 상태인지 확인한 뒤 작성자가 진행 |
| CodeRabbit 자동 리뷰 | **연동 예정** | 설치·설정·테스트 완료로 간주하지 않음 |
| 각 서비스의 개발환경 구축 | 후속 작업 | 프레임워크 프로젝트 생성과 실행 설정 필요 |
| PR 템플릿 | 후속 작업 | 아래 PR 예시는 작성 안내이며 설치된 템플릿이 아님 |

저장소를 확인한 결과, 세 서비스 폴더와 `docs/`에는 현재 `.gitkeep` 파일이 있다. `.gitkeep`은 빈 폴더를 Git에 남기기 위한 관례적인 파일 이름이다. **Spring Boot, React TypeScript, FastAPI를 실제로 설치하거나 실행 가능한 상태로 만든 것은 아니다.**

이 문서에서 저장소 구조·브랜치·Rulesets는 직접 조회한 상태이며, 팀원 권한과 CodeRabbit 진행 상태는 사용자 설명을 반영했다. 보호 규칙이 실제 작업에서 차단되는지에 대한 실습 테스트는 별도다.

## 2. 모노레포란 무엇인가요?

모노레포는 여러 구성 요소를 하나의 Git 저장소에서 관리하는 방식이다. 우리 프로젝트는 웹 화면, 백엔드, AI 서버, 문서를 함께 관리한다.

```text
dart-insight/
├── backend/       # Spring Boot 백엔드 예정
├── frontend/      # React + TypeScript 프론트엔드 예정
├── ai-server/     # FastAPI AI 서버 예정
├── docs/          # 설계·개발·팀 교육 문서
├── .gitignore     # Git 추적에서 제외할 파일 규칙
└── README.md      # 프로젝트 소개
```

| 폴더 | 역할 | 작업 예 |
| --- | --- | --- |
| `backend/` | 서비스 API와 업무 로직 | 공시 조회 API, 데이터 처리 |
| `frontend/` | 사용자에게 보이는 웹 화면 | 검색 화면, 분석 결과 표시 |
| `ai-server/` | AI 관련 API와 분석 처리 | 분석 요청 처리, 모델 연동 |
| `docs/` | 팀의 공유 지식 | API 명세, 설치 안내, 협업 규칙 |

위 작업 예시는 역할을 설명하기 위한 예이며, 이미 구현된 기능 목록이 아니다. 한 저장소를 사용해도 각 서비스는 별도 실행환경과 의존성을 가질 수 있다. 서비스 간 호출 방식, 포트, 런타임 버전, 실행 명령은 개발환경 구축 때 확정한다.

팀원은 저장소를 한 번 Clone하면 모든 폴더를 받는다. 여러 폴더를 수정하는 기능은 하나의 PR로 묶을 수 있지만, 관계없는 변경을 함께 넣지는 않는다.

## 3. 브랜치와 보호 규칙 이해하기

### 3.1 브랜치 역할

| 브랜치 | 역할 | 작업 방법 |
| --- | --- | --- |
| `main` | 팀의 검증된 코드와 문서를 모으는 기준 브랜치 | 검토와 테스트를 마친 feature PR을 병합 |
| `feature/작업명` | 개인별·기능별 작업 공간 | 최신 `main`에서 생성 |

```text
main에서 feature 생성
        ↓
feature에서 수정 → commit → push
        ↓
feature → main PR 생성
        ↓
변경 내용·테스트 확인
CodeRabbit 연동 후에는 AI 리뷰도 확인
        ↓
PR 작성자가 직접 merge
        ↓
팀원들이 main 동기화
```

`main`이 있다는 것만으로 자동 배포가 설정된 것은 아니다. `feature/`는 폴더가 아니라 브랜치 이름의 접두사이며, 각 작업을 시작할 때 만든다.

### 3.2 실제 Rulesets 설정

| 설정 | `protect-main` |
| --- | --- |
| 적용 브랜치 | `main` |
| 활성 상태 | Active |
| PR을 통한 변경 필수 | 적용 |
| 필수 승인 수 | 0명 |
| Force push 제한 | 적용 |
| 브랜치 삭제 제한 | 적용 |
| 우회 대상 | 없음 |

**PR 필수와 승인 필수는 서로 다른 설정이다.** 승인 0명은 다른 사람이 Approve하지 않아도 병합할 수 있다는 뜻이다. `main`에 직접 Push해도 된다는 뜻은 아니다.

현재 확인한 `protect-main` Ruleset에는 필수 상태 검사, Code Owner 승인, 마지막 Push 승인, 리뷰 대화 해결 의무가 설정되어 있지 않다. 따라서 CodeRabbit을 연결하더라도 이 규칙만으로 AI 리뷰 완료 전 병합이 자동 차단되지는 않는다. “리뷰를 확인하고 병합한다”는 팀 운영 규칙과 “GitHub가 병합을 막는다”는 시스템 설정을 구분한다.

규칙은 이후 바뀔 수 있다. 실제 PR에서 병합이 막히면 표시된 조건을 확인하고, 보호 규칙을 끄거나 우회하지 않는다.

### 3.3 팀원 Write 권한

Write 권한으로 작업 브랜치에 Push하고 PR을 생성·병합할 수 있다. 보호 브랜치에 적용된 Rulesets는 그대로 지켜야 한다. 저장소 관리자 권한을 받은 것은 아니며, 다른 사람 브랜치까지 마음대로 수정해도 된다는 의미도 아니다.

## 4. 신규 팀원: 최초 준비와 Clone

### 4.1 시작 전 확인

1. GitHub 조직·저장소 초대를 수락한다.
2. 본인 계정으로 저장소 페이지가 열리는지 확인한다.
3. 컴퓨터에 Git을 설치하고 터미널에서 다음 명령을 실행한다.

```bash
git --version
```

버전이 출력되면 Git을 사용할 수 있다. 명령을 찾지 못한다면 Git 설치부터 진행한다.

### 4.2 커밋 작성자 정보 설정

아래 이름과 이메일은 **본인 정보로 바꾼다.** 이메일 공개를 원하지 않으면 GitHub 이메일 설정에 표시된 본인의 noreply 주소를 사용한다.

```bash
git config --global user.name "본인 이름"
git config --global user.email "본인 GitHub 등록 이메일"
```

`--global`은 이 컴퓨터의 모든 저장소에 적용된다. 이 프로젝트에만 설정하려면 Clone 후 저장소 폴더에서 `--global`을 빼고 실행한다. 이 설정은 커밋 작성자 정보이며 GitHub 로그인 설정은 아니다.

### 4.3 저장소 Clone

프로젝트를 보관할 폴더에서 실행한다.

```bash
git clone https://github.com/ShinhanDSProject/dart-insight.git
cd dart-insight
git remote -v
git status
```

`clone`은 저장소와 이력을 컴퓨터로 가져온다. `origin`은 Clone한 원격 저장소에 자동으로 붙는 이름이다. GitHub 인증이 필요하면 인증 도구의 안내에 따른다. 계정 비밀번호를 Git 비밀번호로 입력하는 방식은 사용하지 않으며, 토큰을 URL이나 문서에 넣지 않는다.

### 4.4 main 확인 및 동기화

새로 Clone하면 기본 브랜치인 `main`이 로컬에 만들어진다. 다음 명령으로 브랜치를 확인하고 최신 상태로 맞춘다.

```bash
git switch main
git pull --ff-only origin main
```

`--ff-only`는 이력이 갈라졌을 때 자동 병합하지 않고 멈추도록 한다.

이 단계까지는 소스 관리 준비다. 현재 서비스 폴더에는 실행용 프로젝트가 없으므로 아직 `npm run dev`, Spring Boot 실행, FastAPI 실행 등을 그대로 시도할 단계는 아니다.

## 5. 기능 개발: feature 생성부터 Push까지

이후 명령은 `dart-insight` 폴더에서 실행한다. 아래 `feature/docs-onboarding`은 예시이므로 실제 작업에 맞는 고유한 이름으로 바꾼다.

### 5.1 최신 main에서 시작

```bash
git status
git switch main
git pull --ff-only origin main
git switch -c feature/docs-onboarding
```

브랜치를 바꾸기 전 `git status`에서 미완료 변경이 없는지 확인한다. 변경이 있다면 현재 브랜치에서 필요한 내용을 커밋하거나, 임시 보관 방법을 팀원에게 확인한 뒤 이동한다. 작업 파일을 무작정 삭제하거나 강제로 되돌리지 않는다.

브랜치 이름은 노션 개발 기준을 따른다: `feature/{WBS ID}-{짧은-영문-이름}`(예: `feature/2.4-financial-compare`), 문서만 바꿀 때는 `docs/{이름}`, 설정만 바꿀 때는 `chore/{이름}`. 하나의 브랜치에는 하나의 작업 목적을 둔다.

### 5.2 파일을 수정하고 확인

이번 예제에서는 `docs/` 안에 문서를 만들거나 수정한다. 실제 기능 개발은 담당 폴더에서 진행한다.

```bash
git status
git diff
```

`git diff`는 추적 중인 파일의 아직 스테이징하지 않은 변경을 보여준다. 새 파일 내용은 이 단계에서 나오지 않을 수 있으므로 에디터에서 확인하고, 추가한 뒤 `git diff --staged`로 다시 확인한다.

### 5.3 필요한 파일만 스테이징하고 Commit

아래 파일 경로는 실제로 수정한 파일 경로로 바꾼다.

```bash
git add docs/monorepo-team-guide.md
git diff --staged
git commit -m "docs: 모노레포 팀 협업 가이드 추가"
```

`git add`는 다음 커밋에 넣을 변경을 고른다. `commit`은 그 변경을 로컬 이력에 기록한다. 아직 GitHub에 올라간 것은 아니다. 초보 단계에서는 모든 파일을 한 번에 추가하는 `git add .`보다 파일을 지정하는 방법을 권장한다.

커밋 메시지 접두사 권장 예: 기능은 `feat:`, 오류 수정은 `fix:`, 문서는 `docs:`, 환경 설정은 `chore:`. 자동으로 강제되는 규칙은 아니다.

### 5.4 작업 브랜치를 Push

```bash
git push -u origin feature/docs-onboarding
```

`-u`는 현재 로컬 브랜치와 원격 작업 브랜치의 연결을 설정한다. 이후 같은 브랜치의 추가 커밋은 `git push`로 전송할 수 있다. Push한 것만으로 `main`에 합쳐지지는 않는다.

## 6. main 대상으로 PR 만들기

1. GitHub 저장소에서 **Compare & pull request**를 누른다. 보이지 않으면 **Pull requests → New pull request**로 이동한다.
2. **base: `main`**, **compare: 본인의 `feature/...`**를 선택한다. 변경을 받을 대상이 `main`이고, 작업 브랜치가 compare에 있는지 확인한다.
3. 변경 파일과 diff에 관계없는 수정이나 비밀정보가 없는지 확인한다.
4. 제목과 설명을 작성하고 PR을 생성한다. 아직 진행 중이면 Draft로 만든다.

PR 설명 예시:

```markdown
## 목적
신규 팀원이 모노레포 협업 절차를 따라갈 수 있도록 가이드를 추가했습니다.

## 변경 사항
- docs/monorepo-team-guide.md 추가

## 확인한 내용
- 명령어 순서와 브랜치 대상 확인
- Markdown 미리보기 및 링크 확인

## 영향 및 주의 사항
- 문서 변경입니다.
- CodeRabbit은 연동 예정으로 표시했습니다.
```

기능 PR에는 실행한 테스트와 결과, 확인하지 못한 항목, 다른 서비스에 미치는 영향도 적는다. 실제로 실행하지 않은 테스트를 통과했다고 쓰지 않는다.

## 7. 리뷰 확인과 PR 작성자의 직접 Merge

### 7.1 현재: CodeRabbit 연동 전

CodeRabbit 리뷰가 자동으로 달린다고 가정하지 않는다. 작성자가 diff와 테스트 결과를 확인하고, API 변경이나 중요한 로직 변경은 관련 팀원에게 검토를 요청한다. 승인 0명이어도 검토 책임이 없어지는 것은 아니다.

### 7.2 연동 후 사용할 절차

1. CodeRabbit 리뷰가 실제로 완료되었는지 확인한다. 리뷰 없음·건너뜀·오류를 완료로 간주하지 않는다.
2. 코멘트가 맞는지 코드와 요구사항을 보고 판단한다.
3. 수정이 필요하면 같은 feature 브랜치에서 수정 → Commit → Push한다. 기존 PR에 반영되므로 PR을 새로 만들 필요가 없다.
4. 최신 커밋에 대한 리뷰와 테스트 결과를 다시 확인한다.
5. 제안을 반영하지 않을 때는 이유를 남긴다. AI의 제안을 이해하지 못한 채 그대로 적용하지 않는다.

CodeRabbit 설치 시에는 저장소 접근 범위와 자동 리뷰를 설정하고, `main` 대상 PR에서 실제 동작을 확인해야 한다. 이 문서는 해당 설정 파일을 설치하거나 연동을 완료하지 않는다.

### 7.3 병합 직전 체크리스트

- [ ] 대상 브랜치가 `main`인지 확인했다.
- [ ] 변경 내용을 직접 읽었고 비밀정보·불필요한 파일이 없다.
- [ ] 필요한 테스트를 수행했고 미확인 사항을 설명했다.
- [ ] 충돌이 없고, 표시된 필수 검사가 있다면 통과했다.
- [ ] CodeRabbit 연동 후에는 최신 변경의 AI 리뷰를 확인했다.
- [ ] 관련 팀원에게 영향을 알렸고 필요한 논의를 마쳤다.

준비가 끝나면 **PR 작성자가 직접 Merge**하고 완료 상태를 확인한다. 이는 본인의 PR에 스스로 Approve한다는 의미가 아니라, 필요한 조건을 만족한 PR의 병합 버튼을 누른다는 뜻이다.

병합 방식은 **Squash and merge** 하나로 정했다(10/21). 저장소 설정(Settings → General → Pull Requests)에서 다른 방식을 끄면 병합 버튼에는 이 방식만 보인다. 설정을 바꾸기 전이라도 병합 버튼 옆 화살표에서 **Squash and merge**를 고른다. PR의 커밋이 하나로 합쳐지고 PR 제목이 `main`의 커밋 제목이 되므로, PR 제목 규칙(`[WBS ID] 이슈 제목`)을 지킨다.

병합 후 더 사용할 일이 없는 feature 브랜치는 GitHub의 **Delete branch**로 정리할 수 있다. `main`은 삭제하지 않는다.

## 8. Merge 후 동기화와 다음 작업

로컬 작업이 정리된 상태에서 실행한다.

```bash
git switch main
git pull --ff-only origin main
git fetch --prune origin
```

`--prune`은 원격에서 삭제된 브랜치의 로컬 원격 추적 참조를 정리한다. 로컬 feature 브랜치를 자동으로 삭제하지는 않는다.

정리할 로컬 브랜치는 다음처럼 삭제한다.

```bash
git branch -d feature/docs-onboarding
```

Squash 또는 Rebase 방식으로 병합했다면 Git이 원래 커밋을 병합된 것으로 판단하지 못해 `-d`를 거부할 수 있다. 이때 바로 강제 삭제하지 말고 GitHub의 Merged 상태, 변경 반영 여부, 아직 필요한 커밋이 없는지를 확인한다. 우리는 Squash 방식을 쓰므로 `-d`가 거부되는 것이 보통이다. 위 내용을 확인한 뒤에만 `git branch -D 브랜치이름`으로 지운다.

다음 작업은 업데이트한 `main`에서 **새로운 feature 브랜치**를 만들어 시작한다. 이미 병합된 브랜치를 계속 재사용하지 않는다.

## 9. 개발 중 main 변경 가져오기와 충돌 해결

다른 팀원의 PR이 병합되어도 본인의 feature가 자동 업데이트되지는 않는다. 다음 절차는 이력을 재작성하지 않는 Merge 방식이다.

### 9.1 현재 작업을 먼저 정리

```bash
git switch feature/docs-onboarding
git status
```

수정 중인 파일이 있다면 필요한 변경을 커밋하고 작업 폴더를 정리한다. 비밀정보까지 커밋해 정리하지 않도록 주의한다.

```bash
git fetch origin
git merge origin/main
```

충돌이 없으면 필요한 테스트를 실행하고 `git push`한다. 이 작업은 **main의 변경을 내 feature로 가져오는 것**이며, feature를 main에 반영하려면 여전히 PR이 필요하다.

### 9.2 충돌이 발생한 경우

```bash
git status
```

충돌 파일을 열면 다음과 같은 표시가 있을 수 있다.

```text
<<<<<<< HEAD
현재 feature 브랜치의 내용
=======
가져온 origin/main의 내용
>>>>>>> origin/main
```

1. 두 변경의 의도를 읽는다. 다른 팀원이 수정한 부분은 담당자와 확인한다.
2. 필요한 내용을 합쳐 최종 코드를 작성한다. 위 충돌 표시 세 줄을 모두 제거한다.
3. 삭제·이름 변경·바이너리 파일 충돌은 이런 표시가 없을 수 있으므로 `git status`의 설명도 확인한다.
4. 실행·테스트로 동작을 확인한다.
5. 해결한 파일을 추가하고 병합을 완료한다.

아래 경로는 실제 충돌 파일로 바꾼다.

```bash
git add docs/monorepo-team-guide.md
git diff --staged
git status
git commit -m "chore: main 변경 병합 및 충돌 해결"
git push
```

에디터의 “현재 변경 수락” 또는 “들어오는 변경 수락”을 의미 확인 없이 선택하지 않는다. 완료가 어렵다면 진행 중인 Merge를 취소할 수 있다.

```bash
git merge --abort
```

`--abort`는 진행 중인 Merge에만 사용한다. 안전하게 취소할 수 있도록 Merge 전 작업 상태를 깨끗하게 만드는 것이 중요하다. 이미 완료한 커밋을 지우는 명령이 아니다.

## 10. 비밀정보와 불필요한 파일 보호

다음 항목은 저장소에 올리지 않는다.

- DART API 키, AI 서비스 API 키, GitHub 토큰
- DB 비밀번호, 실제 인증정보가 들어 있는 환경 설정
- 개인키, 서비스 계정 키, 실제 개인정보가 들어 있는 데이터
- `node_modules/`, `.venv/`, 빌드 결과 등 다시 만들 수 있는 파일

**현재 `.gitignore`는 Java 관련 기본 규칙 중심이다. `.env`, 프론트엔드·Python 의존성 폴더가 모두 보호된 상태는 아니다.** 개발환경을 구축하면서 다음과 같은 규칙을 검토해 추가해야 한다. 아래는 제안이며 현재 저장소에 적용한 내용이 아니다.

```gitignore
# 로컬 환경 설정: 실제 값 대신 .env.example 공유
.env
.env.*
!.env.example

# 프론트엔드 의존성과 빌드 결과
node_modules/
dist/

# Python 환경과 캐시
.venv/
venv/
__pycache__/
*.pyc

# Java 빌드 결과와 캐시
.gradle/
build/
target/
```

설정 파일 전체를 일괄 제외하지 않는다. 예를 들어 `application.yml`은 비밀값 대신 환경변수 참조를 사용하면 공유할 수 있다. 패키지 잠금 파일과 Gradle/Maven Wrapper 같은 재현 가능한 개발에 필요한 파일은 별도로 판단한다. 기존 `*.jar` 규칙이 Wrapper JAR까지 제외하는지도 구축 시 확인한다.

`.env.example`에는 변수명과 가짜 예시 값만 넣는다. 토큰을 PR 설명·리뷰 댓글·스크린샷에도 노출하지 않는다.

```bash
git status
git diff --staged
git check-ignore -v .env
```

`.gitignore`는 이미 추적 중인 파일을 자동으로 제거하지 않는다. 추적을 중단할 필요가 있다면 대상 파일을 확인한 뒤 `git rm --cached 파일경로`를 사용한다. 로컬 파일은 남지만, 과거 커밋의 비밀값이 지워지는 것은 아니다.

비밀정보를 실수로 Push했다면 즉시 팀에 알리고 해당 키를 폐기·재발급한다. 파일을 삭제하는 커밋만으로 노출이 해결되지 않는다. 이력 정리는 관리자가 영향 범위를 확인해 진행하며, 개인이 보호 규칙을 해제하거나 Force push로 처리하지 않는다.

## 11. Git 명령어 빠른 해설

| 명령어 | 의미 |
| --- | --- |
| `git clone URL` | 원격 저장소를 처음 내려받음 |
| `git status` | 현재 브랜치와 파일 상태 확인 |
| `git remote -v` | 연결된 원격 저장소 주소 확인 |
| `git branch --show-current` | 현재 브랜치 이름 확인 |
| `git switch 브랜치` | 기존 브랜치로 이동 |
| `git switch -c 이름` | 현재 위치에서 새 브랜치를 만들고 이동 |
| `git fetch origin` | 원격 이력을 가져옴. 현재 작업 파일은 병합하지 않음 |
| `git pull --ff-only origin main` | 현재 브랜치에 원격 main을 fast-forward 방식으로만 반영. 이 가이드에서는 로컬 main에서 사용 |
| `git diff` | 아직 스테이징하지 않은 추적 파일 변경 확인 |
| `git add 파일` | 커밋할 변경 선택 |
| `git diff --staged` | 다음 커밋에 들어갈 변경 확인 |
| `git commit -m "설명"` | 선택한 변경을 로컬 이력에 기록 |
| `git push -u origin 브랜치` | 원격에 전송하고 추적 관계 설정 |
| `git push` | 연결된 원격 브랜치로 커밋 전송 |
| `git merge origin/main` | 현재 브랜치에 가져온 main 이력을 병합 |
| `git merge --abort` | 진행 중인 Merge 취소 |
| `git restore --staged 파일` | 스테이징만 취소. 작업 파일 내용 유지 |
| `git log --oneline -5` | 최근 커밋 5개 확인 |
| `git fetch --prune origin` | 원격 이력 갱신 및 삭제된 원격 참조 정리 |
| `git branch -d 브랜치` | 안전 조건을 만족하는 로컬 브랜치 삭제 |

PR 생성과 GitHub의 병합 버튼은 GitHub 기능이다. Commit은 저장, Push는 전송, PR은 통합 요청, Merge는 통합이라고 구분하면 이해하기 쉽다.

## 12. FAQ

### Clone은 작업할 때마다 하나요?

아니다. 같은 컴퓨터의 같은 작업 폴더에서는 한 번만 한다. 이후에는 Fetch와 Pull로 갱신한다.

### 다른 폴더를 담당해도 같은 main을 사용하나요?

그렇다. 폴더가 나뉘어 있어도 한 저장소의 같은 통합 브랜치를 사용한다. API 형식이나 공통 설정 변경은 관련 담당자와 협의한다.

### main에 직접 Push했는데 거절됐어요.

PR 필수 규칙에 따른 정상적인 차단일 수 있다. 강제로 밀어 넣지 말고 feature 브랜치와 PR을 사용한다. 로컬 main에 실수로 커밋했다면 그 커밋을 보존하는 feature 브랜치를 먼저 만들고 팀원과 함께 main을 정리한다. `reset --hard`를 무작정 실행하지 않는다.

### 승인 0명이면 리뷰 없이 병합해도 되나요?

다른 사람의 Approve가 필수는 아니지만 작성자의 검토·테스트는 필요하다. CodeRabbit 연동 후에는 AI 리뷰 확인도 팀 절차에 포함된다.

### CodeRabbit 댓글이 없어요.

현재는 연동 예정이므로 댓글이 없어도 이상하지 않다. 연동 후에는 앱 접근 권한, 자동 리뷰 설정, 대상 브랜치, Draft 여부, 건너뜀·오류 메시지를 확인한다. 댓글이 없다는 이유로 “검토 통과”라고 판단하지 않는다.

### PR을 만든 뒤 내용을 수정하고 싶어요.

같은 feature 브랜치에서 추가 Commit과 Push를 하면 기존 PR이 갱신된다. 수정 후 다시 테스트하고 리뷰를 확인한다.

### Push가 non-fast-forward 오류로 거절됐어요.

원격에 로컬에 없는 커밋이 있을 수 있다. Fetch 후 원격 작업 브랜치와 차이를 확인하고, 같은 브랜치를 수정한 팀원이 있는지 확인한다. Force push로 덮어쓰지 않는다.

### Pull의 --ff-only가 실패했어요.

로컬과 원격 이력이 갈라졌을 수 있다. `git status`와 커밋 이력을 확인한 뒤 팀원에게 도움을 요청한다. 실패를 없애려고 강제 초기화하거나 옵션을 무작정 바꾸지 않는다.

### Repository not found 또는 권한 오류가 나요.

저장소 주소, 로그인 계정, 초대 수락 여부를 확인한다. 브라우저에서 보이는 계정과 Git 인증에 사용하는 계정이 다를 수 있다. Write 권한이나 조직 인증 문제는 관리자에게 확인한다.

### Merge 버튼이 비활성화되어 있어요.

Draft, 충돌, 권한, 추가 보호 규칙이나 상태 검사 등 GitHub가 표시하는 이유를 확인한다. 승인 수가 0이어도 모든 상황에서 병합 가능한 것은 아니다.

### feature 브랜치 삭제는 파일을 삭제하는 건가요?

병합된 feature 브랜치를 정리해도 main에 반영된 파일은 남는다. 단, 병합되지 않은 변경이 있다면 보존 여부를 먼저 확인해야 한다.

## 13. 팀 운영 규칙

다음 운영 원칙을 따른다.

1. `main`은 PR을 통해 변경한다.
2. 기능 개발은 최신 `main`에서 만든 feature 브랜치에서 한다.
3. feature PR의 대상은 `main`이다.
4. 승인 0명 설정을 유지하되 작성자가 변경을 검토하고 직접 병합한다.
5. CodeRabbit은 연동 후 리뷰 확인 절차에 포함한다.

다음 세부 관행은 이 문서의 **권장 운영안**이며 팀과 합의해 적용한다.

1. 하나의 PR은 하나의 목적을 다룬다. 큰 변경은 검토 가능한 크기로 나눈다.
2. 작업 시작 전에 담당 범위를 공유하고 같은 파일의 중복 작업을 줄인다.
3. PR에 목적, 변경 내용, 테스트 결과와 미확인 사항을 적는다.
4. API·공통 설정·데이터 구조 변경은 관련 담당자와 먼저 협의한다.
5. 다른 사람의 브랜치를 임의로 수정하거나 강제 Push하지 않는다.
6. 충돌은 양쪽 변경 의도를 확인해서 해결한다.
7. Merge 후 main을 동기화하고 다음 작업은 새 브랜치에서 시작한다.
8. 비밀정보는 저장소 밖에서 관리하고 안전한 예시 설정만 공유한다.
9. 구조나 절차가 바뀌면 `docs/`의 가이드도 함께 갱신한다.

## 14. 다음에 함께 진행할 일

- 이 문서 내용을 검토하고 팀 운영안을 확정한다.
- 별도 작업 브랜치에서 문서를 `docs/monorepo-team-guide.md`로 추가하고 main 대상 PR을 만든다. README 링크 추가는 현재 범위에 포함하지 않는다.
- CodeRabbit을 저장소에 연결하고 main 대상 리뷰 동작을 확인한다.
- 실제 PR로 보호 규칙과 병합 흐름을 확인한다.
- Spring Boot, React TypeScript, FastAPI 프로젝트와 공통 실행 안내를 준비한다.
- 개발환경에 맞게 `.gitignore`, 환경변수 예시, PR 템플릿을 정비한다.

## 참고 자료

- [프로젝트 저장소](https://github.com/ShinhanDSProject/dart-insight)
- [GitHub Rulesets 규칙 설명](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets): PR 요구, 승인 수, Force push 및 삭제 제한의 의미
- [GitHub 병합 방식 설명](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github): 병합 권한과 방식
- [CodeRabbit 설정 참고](https://docs.coderabbit.ai/reference/configuration): 자동 리뷰 설정

공식 문서는 제품 기능을 설명한다. 우리 저장소의 완료 상태는 이 문서의 첫 표를 기준으로 구분하고, 설정 변경 후에는 실제 저장소 상태와 함께 갱신한다.
