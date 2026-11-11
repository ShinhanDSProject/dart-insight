# ADR-0067: Spring Boot와 FastAPI 사이 내부 API를 공유 Bearer 토큰으로 인증한다

- 상태: 채택
- 결정한 날: 2026-11-11
- 관련: [이슈 #872](https://github.com/ShinhanDSProject/dart-insight/issues/872), [ADR-0002](0002-monorepo-and-call-direction.md), [이슈 #127](https://github.com/ShinhanDSProject/dart-insight/issues/127)

## 맥락

- React → Spring Boot → FastAPI 호출 방향과 호스트 방화벽으로 외부에서 FastAPI 내부 API에 직접 접근하지 못하게 했다.
- 네트워크 규칙이 잘못 바뀌어도 `/internal/**`이 무인증으로 노출되지 않도록 애플리케이션 수준의 두 번째 방어가 필요하다.
- backend와 ai-server는 서버 두 대에 각각 배포되며, 실제 비밀값은 이미 서버 환경파일로 주입한다.
- 사용자 인증 JWT는 사용자와 Spring Boot 사이의 약속이므로 서비스 사이 인증에 재사용하지 않는다.

## 결정

- backend의 `AiServerClient`는 ai-server의 모든 요청에 `Authorization: Bearer <토큰>` 헤더를 붙인다.
- ai-server는 `/internal/**`의 모든 요청에서 Bearer 토큰을 확인하고 누락·형식 오류·불일치를 401 `AI_INTERNAL_UNAUTHORIZED`로 거부한다.
- 배포 도구가 쓰는 `/health`는 내부 API 인증 대상에서 제외한다.
- 양쪽 서비스는 같은 `AI_INTERNAL_TOKEN` 환경변수를 읽는다. ai-server는 값이 없거나 32자보다 짧으면 시작하지 않는다.
- 토큰은 `secrets.compare_digest`로 비교하고 값 자체를 오류 응답이나 로그에 남기지 않는다.
- 실제 토큰은 서버 환경파일과 Jenkins 자격증명에만 두고 저장소·Docker 이미지에 넣지 않는다. Compose에는 변수 참조만 둔다.
- IP 방화벽 허용목록은 첫 번째 방어로 유지한다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| IP 방화벽만 사용 | 네트워크 규칙이 잘못 바뀌면 내부 API가 인증 없이 노출된다. 호출자 신원을 애플리케이션에서 확인할 수 없다. |
| 사용자 JWT를 재사용 | 사용자 인증과 서비스 인증의 수명·교체·책임이 섞이고, 사용자 요청이 없는 분석 작업에도 맞지 않는다. |
| mTLS | 서비스 신원과 암호화가 강하지만 현재 두 VM 시연 환경에는 인증서 발급·교체·신뢰 저장소 운영 비용이 크다. |

## 결과

- 좋아지는 점: 방화벽과 공유 토큰의 두 단계로 내부 API를 보호하고, 잘못된 호출은 기능 코드를 실행하기 전에 거부한다.
- 감수하는 점: 두 서버의 토큰을 함께 배포하고 교체해야 한다. 교체 순서가 어긋나면 잠시 AI 호출이 실패한다.
- 지켜야 할 것: 토큰을 로그·응답·Git·이미지에 넣지 않고, `/internal/**` 새 라우터에도 같은 인증 의존성을 적용한다.

## 다시 볼 때

- ai-server 인스턴스나 호출 서비스가 여러 개로 늘어 호출자별 권한이 필요할 때
- 서비스 메시나 사설 인증서 자동화가 생겨 mTLS 운영 비용이 낮아질 때
- 무중단 토큰 교체를 위해 이전·새 토큰을 동시에 허용해야 할 때
