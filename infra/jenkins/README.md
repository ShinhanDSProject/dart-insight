# 인프라 설정과 Jenkins 실행 절차

## 확인된 상태
- 2026-11-06: 세 서비스 검사, 커밋 번호 기반 이미지 생성, 배포 성공.
- 로그인과 분석 결과 조회 확인 완료.
- 자동 실행은 반복 실행 원인 확인 전까지 비활성화한다.
- 배포 실패·복구 시험은 아직 하지 않았으며 마지막에 진행한다.
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
- CI는 현재 chore/jenkins-runtime-images 브랜치를 가져온다.
- 이 설정 브랜치를 만들었다고 운영 소스나 Jenkins 설정이 자동 변경되지는 않는다.
- main 전환은 별도 검토 후 진행한다.
- DB 변경 목록이 현재 DB와 다르면 기존 배포 스크립트는 배포를 중단한다.
- 자동 DB 역마이그레이션은 하지 않는다.
- DB 볼륨 삭제와 docker compose down -v는 일반 재배포 절차에 포함하지 않는다.

## 아직 남은 검증
- 반복 빌드 원인 확인 및 자동 실행 검증.
- DB 백업 복원, 접근 통제, AI 장애 처리 검증.
- 모니터링과 부하 시험.
- 다른 팀원의 운영 절차 확인.
- 맨 마지막에 웹 배포 실패·복구 시험 및 문서 갱신.
