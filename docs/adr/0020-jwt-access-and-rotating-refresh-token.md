# ADR-0020: 짧은 JWT Access Token과 회전하는 Refresh Token으로 로그인 상태를 유지한다

- 상태: 채택
- 결정한 날: 2026-10-24
- 관련: 일반 로그인 이슈, [ADR-0019](0019-user-registration.md), `docs/api-spec.md`, `docs/erd.md`

## 맥락

- 일반 회원가입의 PBKDF2 비밀번호를 검증해 사용자를 인증해야 합니다.
- Access Token 탈취 영향을 줄이면서 새로고침 뒤에도 로그인 상태를 복구해야 합니다.
- 로그아웃과 토큰 재사용 탐지를 위해 Refresh Token은 서버에서 폐기할 수 있어야 합니다.

## 결정

- Access Token은 HS256 JWT이며 기본 수명은 15분입니다. `sub`에 내부 사용자 ID, `iss`, `iat`, `exp`, `token_type=access`를 넣습니다.
- JWT 비밀키와 수명은 환경 설정으로 관리하고 코드·로그·저장소에 실제 값을 남기지 않습니다.
- Refresh Token은 256비트 임의 문자열이며 기본 수명은 14일입니다. 원문은 HttpOnly·SameSite=Strict 쿠키에만 두고 DB에는 SHA-256 해시만 저장합니다.
- 재발급 때 Refresh Token을 회전합니다. 폐기된 토큰 재사용을 발견하면 같은 family의 활성 토큰을 모두 폐기합니다.
- Access Token은 화면 메모리에만 두고 브라우저 저장소에 저장하지 않습니다. 앱 시작 시 Refresh Token으로 복구합니다.
- 기존 공개 API는 그대로 공개하고, 인증 전용 API부터 Bearer JWT를 요구합니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| Access·Refresh 모두 JWT | Refresh Token 즉시 폐기와 재사용 탐지에 결국 서버 상태가 필요합니다. |
| Access Token을 localStorage에 저장 | 스크립트가 실행되면 장기간 탈취될 수 있어 메모리에만 둡니다. |
| 서버 세션만 사용 | 향후 API 소비자에서 Bearer 인증을 재사용하기 어렵습니다. |

## 결과

- 재발급과 로그아웃은 DB 쓰기가 필요합니다.
- HTTPS 운영 환경에서는 Refresh 쿠키의 Secure 설정을 반드시 켭니다.
- 키 교체가 필요해지면 `kid`와 복수 검증 키를 지원하는 새 ADR로 대체합니다.

## 다시 볼 때

- 소셜 로그인, 여러 기기 세션 목록, 강제 로그아웃, 비밀키 교체를 도입할 때
