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
- Agent의 ops/deploy-ai-backend.sh 경로에 검토한 배포 스크립트를 배치한다.
- 키와 Agent 연결 secret은 저장소에서 관리하지 않는다.

## 현재 배포 작업의 전제
- Pipeline과 배포 스크립트에는 현재 환경의 대상 주소·경로가 들어 있다.
- 다른 환경에서 사용할 때 대상 주소, 경로, SSH 키 경로를 먼저 검토한다.
- CI는 현재 chore/498-mail-cicd-resume 브랜치를 가져온다.
- 이 설정 브랜치를 만들었다고 운영 소스나 Jenkins 설정이 자동 변경되지는 않는다.
- main 전환은 별도 검토 후 진행한다.
- DB 변경 목록이 현재 DB와 다르면 기존 배포 스크립트는 배포를 중단한다.
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
- 감지와 빌드 대상은 모두 chore/498-mail-cicd-resume로 제한한다. main이나 다른 브랜치 변경은 이 작업의 실행 대상이 아니다.
- Poll SCM은 H/5 * * * *를 사용하며 Build periodically와 구분한다. Jenkinsfile에 같은 예약을 기록했다.
- 문서만 변경한 커밋 한 건으로 실제 감지를 시험하고, 수동 빌드를 추가로 누르지 않는다.
- 실행 원인 Started by an SCM change, 체크아웃 커밋 일치, 하위 배포 작업 성공, 최종 SUCCESS를 모두 확인한다.
- 완료 후 다음 감지에서 같은 커밋이 already built / No changes인지 확인한다.
- 같은 커밋을 반복 빌드하거나 main을 다시 감지하면 자동 실행을 끄고 로그를 확인한다.

## 운영 환경변수와 재배포
- 뉴스·메일·소셜 로그인 변수는 deploy/.env에 실제 값을 저장하고 backend.environment로 전달한다.
- Compose의 --env-file은 값 치환 입력이며 모든 항목을 컨테이너로 자동 전달하지 않는다.
- 실제 환경 파일은 저장소에서 복사하거나 덮어쓰지 않는다. 예제에는 가짜 값만 둔다.
- 운영 AI의 LLM_MODEL은 gpt-4o-mini로 설정했다. 이 PR의 compose.ai.yaml 모델 기본값은 아직 이전 값이므로 AI 설정 동기화는 별도 확인한다. 변경 후 실제 LLM 호출 성공도 별도 검증이 필요하다.
- 기존 정상 백엔드·웹은 mail-00525195 이미지이며 DB는 V51까지 적용됐다. 시험 복구 후 웹 태그가 rollback-web으로 바뀌어도 이미지 ID로 같은 버전인지 확인한다.
- 이 PR의 소스는 운영 00525195와 아직 다르다. 파일 정리와 앱 버전 통합을 구분하고 코드 통합·DB 차이 검토가 끝나기 전에 Poll SCM을 켜지 않는다.

## AI 접근 제한 파일
- infra/firewall/dart-ai-firewall을 VM2의 /usr/local/sbin/dart-ai-firewall에 설치한다(권한 755).
- infra/firewall/dart-ai-firewall.service를 /etc/systemd/system에 설치하고 daemon-reload 후 enable --now 한다.
- 규칙은 현재 배포 환경의 인터페이스·원래 목적지·허용 출발지에 맞춰져 있다. 다른 환경에서 그대로 실행하지 않는다.
- Docker 재시작·VM 재부팅 후 상태 및 정상·차단 요청을 시험한 결과는 #795에 기록했다.
- 등록은 이미 운영 서버에서 완료됐다. 저장소 파일 추가만으로 서버에 다시 설치하지 않는다.

## VM1 현재 설정 반영
- 담당자가 확인한 VM1의 뉴스·메일·소셜 로그인 환경변수 연결을 deploy/compose.yaml에 반영했다.
- deploy/compose.release.yaml에는 배포 성공을 확인한 226badcf03777978ec6d9f64a1deaf61e338f4ff를 기록했다.
- 서버의 deploy/nginx.chunk-test.conf 내용은 이미 frontend/nginx.conf와 같아 정식 파일을 유지한다.
- .bak 및 .before 백업과 임시 Nginx 파일은 서버에 보관하고 Git에 추가하지 않는다.
- 실제 내부 IP를 공개하지 않도록 AI_SERVER_URL만 환경변수로 분리했다. 이 Git 설정을 서버에서 사용할 때 deploy/.env에 실제 AI_SERVER_URL을 먼저 채운다.
- deploy/.env.example의 example.invalid 주소는 가짜 값이다. 기존 서버의 실제 키와 설정을 예제로 덮어쓰지 않는다.
- 기존 운영 서버 파일을 자동 덮어쓰거나 재배포하는 변경은 아니다.
