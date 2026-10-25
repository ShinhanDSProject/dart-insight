# ADR-0022: 소셜 계정은 제공자 사용자 ID로 식별하고 서비스 토큰으로 전환한다

- 상태: 채택
- 결정한 날: 2026-10-24
- 관련: [#225](https://github.com/ShinhanDSProject/dart-insight/issues/225), [ADR-0019](0019-user-registration.md), [ADR-0020](0020-jwt-access-and-rotating-refresh-token.md)

## 맥락

- Google, Kakao, Naver 로그인을 지원하되 일반 회원과 같은 내부 사용자 ID와 세션 정책을 사용해야 합니다.
- 제공자 이메일은 누락·변경될 수 있고 같은 이메일의 일반 계정을 사용자가 소유한다고 단정할 수 없습니다.

## 결정

- Spring Security OAuth2 Client의 Authorization Code 흐름을 사용합니다.
- 계정 연결 키는 `(provider, provider_user_id)`이며 이메일로 기존 계정을 자동 통합하지 않습니다. 이메일은 제공자가 주지 않으면 null로 저장하고 로그인을 막지 않습니다.
- OAuth 흐름은 state를 서버 세션에 두므로, 소셜 로그인 경로(`/oauth2/authorization/**`, `/login/oauth2/code/**`, `/api/social-sessions/**`)만 세션을 쓰는 별도 보안 필터 체인에 둡니다. 나머지 API는 세션 없는(STATELESS) Bearer JWT 체인을 그대로 써서, 소셜 로그인 중의 서버 세션으로 인증되지 않게 합니다(`SecurityConfig`). 콜백에서 서비스 토큰을 발급한 뒤 세션을 폐기합니다.
- 최초 로그인은 `app_user`와 `social_account`를 만들고 이후 로그인은 기존 `app_user`를 재사용합니다.
- 제공자 토큰은 사용자 정보 조회에만 사용하고 저장하지 않습니다. 인증 후 ADR-0020의 서비스 Access Token과 Refresh Token을 발급합니다.
- 클라이언트 ID·비밀키와 성공 이동 주소는 환경변수로 관리합니다.

## 결과

- 같은 사람이 여러 제공자나 일반 가입에서 같은 이메일을 써도 별도 회원이 될 수 있습니다.
- 계정 통합·연결 해제는 소유 확인 절차를 정한 후 별도 이슈에서 구현합니다.
- Refresh Token 쿠키는 ADR-0020대로 `SameSite=Strict`입니다. 화면과 API가 같은 사이트(같은 도메인, 로컬은 localhost의 다른 포트)일 때만 소셜 로그인 뒤 세션 복구가 됩니다. 화면과 API를 다른 사이트에 배포하면 이 결정을 다시 봅니다.
