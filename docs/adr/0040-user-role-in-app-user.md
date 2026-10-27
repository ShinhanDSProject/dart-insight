# ADR-0040: 관리자 역할은 app_user.role에 두고 관리자 API마다 DB로 확인하며, 첫 관리자는 환경변수의 이메일 목록으로 로그인할 때 정한다

- 상태: 제안
- 결정한 날: 2026-10-27
- 관련: #457(6.6, FS-58 기업별 커뮤니티), 노션 결정 로그 '커뮤니티(기업별 게시판) 범위와 운영 원칙', [ADR-0019](0019-user-registration.md), [ADR-0020](0020-jwt-access-and-rotating-refresh-token.md), [ADR-0022](0022-social-login-provider-identity.md)

## 맥락

- 커뮤니티(FS-58)는 신고된 글·댓글을 관리자가 유지·블라인드·삭제로 처리한다(R7·R12). 지금까지는 로그인한 사용자가 모두 같은 권한이라 역할 개념이 없다. `app_user`에는 `id`·`created_at`·`updated_at`만 있고(V11), 이메일은 `local_credential`·`social_account`에 있다.
- Access Token은 HS256 JWT이고 `sub`(사용자 ID)·`iss`·`iat`·`exp`·`token_type`만 담으며 수명은 15분이다([ADR-0020](0020-jwt-access-and-rotating-refresh-token.md), `auth/service/JwtService`). 인증이 필요한 경로는 `auth/config/SecurityConfig`의 `securityFilterChain`에서 `authenticated()`로 정한다.
- 결정 로그에서 '관리자 역할 칼럼을 둔다'고 정했다. 관리자를 지정하는 화면은 범위 밖이다.
- 마이그레이션은 모든 환경에 같이 돌아서, 특정 사람의 계정을 관리자로 넣을 수 없다(시연 서버와 각자의 로컬 DB의 사용자 ID가 다르다). 팀 공용 키처럼 환경마다 다른 값은 `.env`·서버 환경변수로 둔다(AGENTS.md 비밀정보).
- 관리자는 시연을 맡는 팀원 몇 명이고, 일정은 기능 동결(11/11)까지 약 2주다.

## 결정

- `app_user`에 `role VARCHAR(10) NOT NULL DEFAULT 'USER'`을 더한다. 값은 `USER`, `ADMIN` 두 가지이고 `ENUM`을 쓰지 않는다(erd 작성 규칙). 닉네임 `nickname`도 같은 마이그레이션에서 더한다(`docs/erd.md`).
- 역할은 JWT에 넣지 않는다. 관리자 경로(`/api/admin/**`)는 `SecurityConfig`에서 인증을 요구하고, 그 위에 요청마다 `sub`로 `app_user.role`을 읽어 `ADMIN`이 아니면 403 `AUTH_FORBIDDEN`으로 막는 `AuthorizationManager`(`auth/config/AdminAuthorizationManager`)를 둔다. 관리자 판단은 이 한 곳에서만 한다. 커뮤니티 서비스는 다시 확인하지 않는다.
- 첫 관리자는 환경변수 `ADMIN_EMAILS`(쉼표로 구분한 이메일 목록, 기본은 빈 값)로 정한다. 로그인에 성공한 순간(일반 로그인 `POST /api/sessions`, 소셜 로그인 콜백) 그 사용자의 이메일이 목록에 있으면 `role`을 `ADMIN`으로 바꾼다.
  - 소유가 확인된 이메일로만 대조한다: 일반 가입은 `local_credential.email_verified = true`인 이메일, 소셜 로그인은 제공자가 확인했다고 한 이메일(`social_account.email_verified = true`). 지금 일반 가입은 이메일 소유를 확인하지 않아(ADR-0019, `email_verified`가 항상 false) 일반 가입 계정은 목록에 있어도 관리자가 되지 않는다. 첫 관리자는 이메일을 확인해 주는 소셜 계정(예: Google)으로 로그인해 정한다.
  - 목록은 올리기만 한다. 목록에서 빠져도 `ADMIN`을 자동으로 내리지 않는다(내릴 때는 DB를 직접 고친다. 절차는 `docs/local-setup.md`에 적는다).
  - 설정 이름은 `app.auth.admin-emails`(`AuthProperties`)로 두고, `application.yml`에서 `admin-emails: ${ADMIN_EMAILS:}`로 환경변수를 잇는다(`JWT_SECRET`과 같은 방식. Spring의 느슨한 바인딩은 `ADMIN_EMAILS`를 이 설정에 저절로 잇지 않는다). `.env.example`에는 변수 이름과 가짜 값만 둔다.
- 화면이 관리자 메뉴를 보일지 알 수 있게 `GET /api/sessions/current`가 `admin`(boolean)과 `nickname`을 함께 준다. 화면의 표시는 편의일 뿐이고, 권한은 위 서버 확인으로만 정한다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 역할을 JWT 클레임(`roles`)에 넣고 Spring Security 권한으로 확인 | 요청마다 DB를 읽지 않아도 되지만, 역할을 바꾸거나 빼도 이미 발급한 Access Token(15분)과 Refresh Token 회전으로 이어지는 동안 옛 권한이 남는다. 관리자 API는 신고 처리 몇 개뿐이라 요청마다 사용자 행 하나를 읽는 비용이 작다 |
| 역할 테이블(`user_role`, 사용자당 여러 역할) | 지금 필요한 역할은 관리자 하나다. 표와 조인이 늘어나는 만큼 얻는 것이 없다. 역할이 늘면 그때 새 ADR로 옮긴다 |
| 첫 관리자를 마이그레이션이나 시작 시 시드로 넣기 | 환경마다 사용자 ID·이메일이 달라 마이그레이션에 넣을 수 없고, 시드 계정은 비밀번호를 어딘가에 적어야 한다(비밀정보 규칙) |
| 관리자 지정을 DB 직접 수정으로만 하기 | 시연 서버에서 매번 DB에 접속해야 하고, 로컬 DB를 지울 때마다 다시 해야 한다. 환경변수 목록은 `.env`에 한 줄로 끝난다 |
| 관리자 여부를 이메일 목록으로만 판단(DB 칼럼 없음) | 요청마다 이메일을 찾으려면 `local_credential`·`social_account`를 함께 읽어야 하고, 결정 로그의 '관리자 역할 칼럼'과 다르다 |

## 결과

- 좋아지는 점: 역할을 바꾸면 다음 요청부터 바로 반영된다. 관리자 판단이 `AdminAuthorizationManager` 한 곳에 있어 관리자 API를 더해도 경로만 `/api/admin/` 아래에 두면 된다. 실제 이메일은 `.env`·서버 환경변수에만 있다.
- 감수하는 점: 관리자 API 요청마다 `app_user` 조회 한 번이 더 든다. 확인된 이메일로만 대조하므로, 이메일 확인이 없는 지금은 일반 가입 계정을 관리자로 만들 수 없다. 관리자는 이메일을 확인해 주는 소셜 계정으로 로그인해야 한다(이메일 확인을 도입하면 일반 가입 계정도 저절로 대상이 된다). 다른 사람이 목록의 이메일로 먼저 일반 가입해도 관리자가 되지 않는다.
- 지켜야 할 것:
  - 관리자만 쓰는 API는 `/api/admin/` 아래에 둔다(`ApiPaths`). 다른 경로에서 역할을 따로 확인하지 않는다.
  - 응답·로그에 역할을 바꾼 이메일을 남기지 않는다(사용자 ID만).
  - 역할 값은 `USER`·`ADMIN` 밖의 값을 쓰지 않는다. 새 역할이 필요하면 새 ADR을 쓴다.

## 다시 볼 때

- 관리자 말고 다른 역할(예: 기업별 운영자)이 필요해질 때
- 관리자를 화면에서 지정·해제해야 할 때
- 이메일 소유 확인을 도입할 때(일반 가입 계정이 관리자 대상이 된다)
- 관리자 API가 많아져 요청마다 DB를 읽는 비용이 문제가 될 때
