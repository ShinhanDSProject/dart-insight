# 인프라 설정과 Jenkins 실행 절차

## 확인된 상태
- 2026-11-06: 세 서비스 검사, 커밋 번호 기반 이미지 생성, 배포 성공.
- 로그인과 분석 결과 조회 확인 완료.
- 지정 인프라 브랜치를 5분 간격으로 감지하도록 설정했다. 변경이 없을 때 No changes로 재빌드를 막는 것을 확인했다.
- 문서 변경 커밋 123da528d7c34b19528bebc29b55af56de4eeb6a의 SCM 자동 실행부터 서비스·웹 배포 SUCCESS까지 확인했다.
- 2026-11-09: 시험 웹 이미지의 HTTP 503을 감지하고 이전 이미지로 자동 복구했다. 정상 이미지 ID 일치, 웹 HTTP 200 및 백엔드 UP을 확인했다.
- Chroma·임베딩 운영 연결은 현재 범위에서 제외한다.

## 파일 역할
- backend/Dockerfile: Spring Boot 빌드 및 실행 이미지.
- frontend/Dockerfile: 프론트엔드 검사·빌드 및 Nginx 실행 이미지.
- frontend/nginx.conf: 정적 화면과 백엔드 요청 전달 설정.
- ai-server/Dockerfile: FastAPI 실행 이미지.
- deploy/compose.yaml: 앱·DB 기본 설정.
- deploy/compose.release.yaml: 백엔드·웹 배포 이미지 버전.
- deploy/compose.ai.yaml: AI 기본 설정.
- deploy/compose.ai.release.yaml: AI 배포 이미지 버전.
- infra/jenkins/compose.yaml: Jenkins Controller 설정.
- infra/jenkins/compose.agent.yaml: Jenkins Agent 설정.
- infra/jenkins/agent/Dockerfile: Java·Git·Docker 도구를 갖춘 Agent 이미지.
- Jenkinsfile.ci-cd: 소스 검사 → 이미지 생성 → 서비스 배포 → 웹 배포.
- Jenkinsfile.services-deploy: AI·백엔드 배포 작업.
- Jenkinsfile.web-deploy: 웹 배포 작업.
- Jenkinsfile.release-deploy: 준비된 이미지의 통합 배포 작업.
- deploy-ai-backend.sh: 서비스 배포·상태 확인·복구 처리.

## 환경 파일 준비
예제 파일을 복사한 뒤 실제 값은 서버에서만 채운다.
- deploy/.env.example → deploy/.env
- deploy/ai.env.example → deploy/ai.env
- infra/jenkins/agent.env.example → infra/jenkins/agent.env
실제 환경 파일, SSH 개인키, DB 덤프는 커밋하지 않는다.
예제의 replace-with-your-value는 실행 가능한 실제 값이 아니다.

## Jenkins Agent 준비
- Controller의 Agent 이름과 vm2-builder 설정을 맞춘다.
- dart-builder 라벨을 Agent에 설정한다.
- Docker 소켓의 그룹 번호와 compose.agent.yaml의 group_add를 맞춘다.
- Agent 작업 볼륨의 .ssh 경로에 배포용 개인키와 known_hosts를 별도로 준비한다.
- 서버 호스트 키는 신뢰할 수 있는 경로로 확인한다.
- deploy-targets.env.example의 변수 이름을 참고해 Agent의 ops/deploy-targets.env에 실제 주소를 작성한다(권한 600). Git에는 올리지 않는다.
- Agent의 ops/deploy-ai-backend.sh는 CI가 검사 완료 후 배치한다.
- 키와 Agent 연결 secret은 저장소에서 관리하지 않는다.

## 현재 배포 작업의 전제
- 배포 대상 주소는 Agent의 ops/deploy-targets.env에서 VM1_HOST·VM2_HOST로 읽는다. 예제의 example.invalid는 실제 주소가 아니다.
- AI Compose의 AI_BIND_ADDRESS는 서버의 실제 바인딩 주소로 별도 설정한다.
- 경로와 SSH 키 경로는 환경별로 검토한다.
- Jenkins의 SCM 브랜치와 Jenkinsfile 내부 체크아웃은 모두 main으로 맞춘다.
- Script Path는 infra/jenkins/Jenkinsfile.ci-cd다. 저장소 병합만으로 Jenkins 작업의 SCM 브랜치가 바뀌지는 않는다.
- 검사와 세 실행 이미지 생성이 모두 성공하면 같은 커밋 번호로 AI·백엔드, 웹 순서로 배포한다.
- CI는 검사를 통과한 커밋의 deploy-ai-backend.sh를 Agent의 ops 경로에 설치한다.
- DB 적용 목록이 같으면 진행하고, 새로운 변경은 아래의 검토 목록과 SQL 내용 해시가 일치할 때만 진행한다.
- 자동 DB 역마이그레이션은 하지 않는다.
- DB 볼륨 삭제와 docker compose down -v는 일반 재배포 절차에 포함하지 않는다.

## 추가 검증과 운영 정리
- 메일 적용 버전 00525195에 빌드 설정을 추가한 현재 브랜치의 226badc로 #131 검사·배포를 통과하고 Poll SCM을 재개했다. 후속 감지의 No changes 및 구글·카카오 로그인·뉴스 조회 유지를 확인했다.
- DB 백업을 격리된 시험 DB에 복원해 주요 건수 및 57개 테이블 검사를 통과했다(#789, #790).
- AI 중단 중 연결 DOWN과 웹·백엔드 유지, 재시작 후 UP을 확인했다(#791).
- 포트 공개 범위, AI의 VM1 허용·일반 PC 차단, 자동 적용 서비스 등록 및 Docker 재시작·VM 재부팅 후 유지까지 확인했다(#792~#795).
- 실제 분석 도중 AI 오류 처리, 복원 DB에 앱을 연결하는 시험 및 전체 보안 점검은 별도 미완료다.
- 모니터링과 부하 시험.
- 다른 팀원의 운영 절차 확인.
- 운영 설정과 Git 파일 차이의 반영 및 새 대상 버전 검사·배포 검증.

## 자동 실행 확인 절차
- 감지와 빌드 대상은 모두 main으로 제한한다. 다른 브랜치 변경은 실행 대상이 아니다.
- Poll SCM은 * * * * *(1분마다)를 사용하며 Build periodically와 구분한다. Jenkinsfile에 같은 예약을 기록했다.
- 지난 성공 빌드(GIT_PREVIOUS_SUCCESSFUL_COMMIT) 이후 바뀐 서비스만 검사·이미지 생성·배포한다. backend/·ai-server/가 바뀌면 AI·백엔드를 함께, frontend/가 바뀌면 웹을 배포한다. 이전 기록이 없거나 같은 커밋을 다시 돌리거나 infra/가 바뀌면 전부 실행한다. docs/처럼 서비스 밖만 바뀌면 검사·배포 없이 끝난다.
- 백엔드 테스트는 Gradle 빌드 캐시(--build-cache, 캐시는 dart_ci_gradle_cache 볼륨)를 써서, 입력이 같은 컴파일·테스트 결과를 다시 쓴다.
- 문서만 변경한 커밋 한 건으로 실제 감지를 시험하고, 수동 빌드를 추가로 누르지 않는다. 이 커밋은 서비스가 바뀌지 않아 검사·배포 단계를 건너뛴다.
- 실행 원인 Started by an SCM change, 체크아웃 커밋 일치, 콘솔의 '백엔드·프론트엔드·AI' 표시가 모두 false이고 서비스 검사·이미지 생성·배포 단계가 건너뛰어졌는지, 최종 SUCCESS를 확인한다.
- 배포까지 시험하려면 서비스 폴더(예: frontend/)를 바꾼 커밋으로 해당 서비스 단계와 하위 배포 작업 성공을 확인한다.
- 완료 후 다음 감지에서 같은 커밋이 already built / No changes인지 확인한다.
- 같은 커밋을 반복 빌드하면 자동 실행을 끄고 SCM 감지 브랜치와 실제 체크아웃 브랜치가 모두 main인지 확인한다.

## 운영 환경변수와 재배포
- 뉴스·메일·소셜 로그인 변수는 deploy/.env에 실제 값을 저장하고 backend.environment로 전달한다.
- Compose의 --env-file은 값 치환 입력이며 모든 항목을 컨테이너로 자동 전달하지 않는다.
- 실제 환경 파일은 저장소에서 복사하거나 덮어쓰지 않는다. 예제에는 가짜 값만 둔다.
- AI의 LLM_MODEL 기본값을 운영 설정과 같은 gpt-4o-mini로 맞췄다. 실제 키는 deploy/ai.env에 둔다. 모델 호출 성공은 별도 로그로 확인한다.
- main 전환 전 정상 운영 이미지는 226badcf03777978ec6d9f64a1deaf61e338f4ff이며 DB는 V51까지 적용됐다. 전환 후 실제 태그와 DB 적용 버전은 배포 로그에서 다시 확인한다.
- 배포는 서버의 기존 .env·ai.env·기본 Compose를 덮어쓰지 않고 release Compose의 대상 이미지 태그만 갱신한다.

## AI 접근 제한
- 운영 서버의 접근 제한 규칙은 별도로 설치돼 있다. 상세 네트워크 설정과 실제 비밀값은 공개 저장소에 추가하지 않는다.
- Docker 재시작·VM 재부팅 후 정상·차단 요청 및 Agent 재연결 결과는 #795에 기록했다.

## VM1 현재 설정 반영
- 담당자가 확인한 VM1의 뉴스·메일·소셜 로그인 환경변수 연결을 deploy/compose.yaml에 반영했다.
- deploy/compose.release.yaml에는 배포 성공을 확인한 226badcf03777978ec6d9f64a1deaf61e338f4ff를 기록했다.
- 서버의 deploy/nginx.chunk-test.conf 내용은 이미 frontend/nginx.conf와 같아 정식 파일을 유지한다.
- .bak 및 .before 백업과 임시 Nginx 파일은 서버에 보관하고 Git에 추가하지 않는다.
- 실제 내부 IP를 공개하지 않도록 AI_SERVER_URL만 환경변수로 분리했다. 이 Git 설정을 서버에서 사용할 때 deploy/.env에 실제 AI_SERVER_URL을 먼저 채운다.
- deploy/.env.example의 example.invalid 주소는 가짜 값이다. 기존 서버의 실제 키와 설정을 예제로 덮어쓰지 않는다.
- 기존 운영 서버 파일을 자동 덮어쓰거나 재배포하는 변경은 아니다.

## 검토한 DB 변경
- V52__add_text_event_signal_and_sentence.sql: 사건 분석용 nullable 열과 text_event_sentence 테이블을 추가한다. 기존 행을 삭제하거나 다시 쓰지 않는다.
- 검토한 SQL의 SHA-256: d1dc0381ea93b872ae5e9c90bf964efe420aa20d42ae75f33937cea47682e9df.
- V53__create_period_activity.sql: 기간 활동 및 영향 분석 저장용 테이블(period_activity)을 추가한다. 기존 테이블을 변경하거나 삭제하지 않는다.
- 검토한 SQL의 SHA-256: 4e386466d3b7993627894a440d2ab921a3d0f053fa8aab9327bacbaed679b127.
- V54__add_disclosure_window_fetch_scope.sql: 공시 분석 탭 요약·타임라인용 범위 구분 열(scope) 및 복합 유니크 키를 추가한다. 기존 행을 삭제하지 않는다.
- 검토한 SQL의 SHA-256: 0e0c0be2205877ce8968440248150edcefe45bf899c3d3af601986ce8ed0b277.
- V53에서 V54로 진행할 때 이 내용과 정확히 일치하는 파일만 허용한다. 다른 새 버전·수정된 V54·실패 기록·이전 버전 이미지는 배포 전에 차단한다.
- 서비스 교체 전 DB 전체 덤프를 만들고 새 백엔드의 Flyway가 적용한다. 백업은 서버에만 저장한다.
- 앱 이미지 복구는 DB를 되돌리지 않는다. V52는 추가 변경이지만, 실제 DB 복원은 별도 검토·절차가 필요하다.
- tests/test_migration_preflight.py는 실제 DB 없이 동일 버전, 승인 변경, 내용 변경, 미승인 변경, 이전 이미지, 실패 기록 등을 시험한다.
- 운영 기록은 Jenkins 실행 원인, 체크아웃 커밋, 하위 배포 결과, 실제 이미지 태그, DB 버전과 상태 확인 결과로 남긴다.

## AI Compose 실행 시 환경 파일
- AI의 env_file은 컨테이너에 값을 전달한다. ports의 AI_BIND_ADDRESS 치환에는 Compose 자체의 --env-file 입력도 필요하다.
- AI 실행·조회에는 docker compose --env-file deploy/ai.env -f deploy/compose.ai.yaml -f deploy/compose.ai.release.yaml 명령을 사용한다.
- 서비스 배포 스크립트도 같은 환경 파일을 지정한다. 기존 서버의 실제 키와 주소는 변경하지 않는다.
