# ADR-0043: 앱과 AI를 두 VM에 분리하고 VM2의 Jenkins로 배포한다

- 상태: 제안
- 결정한 날: 2026-10-29
- 관련: #120, #119, #125, #487, #488, [ADR-0002](0002-monorepo-and-call-direction.md), [배치 구성도](../infrastructure/architecture.md)

## 맥락

팀은 학원 VM 2대 환경에서 앱과 AI를 역할별로 나누고 VM2에 Jenkins를 포함하기로 했다. 외부 서비스 진입은 HTTPS 443을 사용한다. 실제 VM 사양, 관리·배포 경로, 모니터링 위치는 아직 검증 대상이다. 서버용 배포 설정은 main에서 확인되지 않아 이 문서는 구현 전 검토안이다.

## 결정

- VM1에 Nginx·React 정적 파일·Spring Boot·MariaDB를 배치한다.
- VM2에 FastAPI·Jenkins를 배치한다. 별도 LangGraph Worker를 배포 필수 조건으로 두지 않는다.
- React→Spring Boot→FastAPI 호출 방향, backend의 OpenDART 조회·저장 책임은 ADR-0002대로 유지한다.
- 서버 실행은 VM별 Docker Compose를 사용한다. 개인 PC의 MariaDB 직접 설치 방침은 바꾸지 않는다.
- Jenkins로 검사·이미지 빌드·VM별 배포를 구성한다. 기존 GitHub Actions 검사 제거는 이 문서 PR에서 수행하지 않는다.
- Chroma 실제 사용과 저장 방식, Prometheus·Grafana 위치는 관련 이슈에서 확인한다.
- 배치 근거와 경계는 `docs/infrastructure/architecture.md`에 기록한다. 실행 설정·Jenkinsfile은 #121·#125·#487·#488 구현 PR에서 추가한다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 앱·AI·Jenkins를 VM 하나에 함께 배치 | 구성은 단순하지만 빌드·분석과 일반 API가 같은 호스트 자원을 직접 경쟁한다. |
| VM1 앱·모니터링, VM2 AI, GitHub Actions로 CI/CD | 이전 검토안이었으나 팀이 Jenkins를 VM2에 포함하는 방향을 선택했다. 실제 빌드 경합은 측정해야 한다. |

## 결과

- 좋아지는 점: 앱과 AI의 실행 자원을 분리하고 배포 기록을 Jenkins에서 관리할 수 있다.
- 감수하는 점: 두 VM의 통신·배포·저장을 관리해야 한다. VM2에서 AI와 빌드가 경합하며 서비스 복제가 없으므로 고가용성 구성은 아니다.
- 지켜야 할 것: 내부 포트 직접 공개 금지, 비밀값 분리, 제한된 빌드 동시성·데이터 보존, 실제 검증 결과 기록. 미설치 서비스를 설치 완료로 표시하지 않는다.

## 다시 볼 때

실제 VM 자원과 통신 제약이 확인되거나 Jenkins 빌드가 AI에 영향을 줄 때, Chroma를 실제 사용하기 시작할 때, 서비스 복제나 별도 빌드 서버가 필요할 때 검토한다.
