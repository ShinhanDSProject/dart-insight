# ADR-0019: 공통 회원과 일반 가입 정보를 분리하고 비밀번호는 전용 인코더로 해시한다

- 상태: 채택
- 결정한 날: 2026-10-22
- 관련: [#136](https://github.com/ShinhanDSProject/dart-insight/issues/136), [ADR-0002](0002-monorepo-and-call-direction.md), [ADR-0005](0005-error-format-and-trace-id.md), [ADR-0007](0007-flyway-migrations.md), `docs/api-spec.md`, `docs/erd.md`

## 맥락

- #136은 일반 회원가입만 다룹니다. 소셜 로그인, 일반 로그인 순서로 후속 개발할 예정입니다.
- 현재 회원 테이블과 인증 의존성은 없습니다. React는 Spring Boot를 호출하고 회원 데이터는 backend가 MariaDB에 저장합니다.
- 소셜 회원에게 일반 비밀번호를 강제로 만들거나 제공자별로 별개의 회원 체계를 만들지 않아야 합니다.

## 결정

- 공통 회원 `app_user`와 일반 가입 정보 `local_credential`을 분리합니다. 이메일은 정규화한 일반 가입 ID로만 사용하고 공통 PK는 자동 증가 BIGINT로 둡니다.
- 이메일 소유 확인 여부를 따로 저장합니다. 미확인 이메일은 소셜 계정 자동 연결이나 소유 확인의 근거로 쓰지 않습니다.
- 회원가입은 backend `user` 기능 패키지에서 처리합니다. API 경로는 기존 `ApiPaths`와 frontend `endpoints.ts`에 등록합니다.
- `spring-security-crypto`의 `Pbkdf2PasswordEncoder`를 사용합니다. PBKDF2-HMAC-SHA256, 반복 600,000회, 무작위 salt 16바이트, 해시 256비트로 명시적으로 구성합니다. 기존 JDK에서 지원하며 추가 암호 제공자가 필요 없습니다.
- `DelegatingPasswordEncoder`에 `pbkdf2-v1`을 등록해 `{pbkdf2-v1}` 접두사를 저장합니다. 이후 비용·방식 변경 시 기존 비밀번호 검증 방법을 식별할 수 있게 합니다.
- 비밀번호는 검증 전에 길이 상한을 확인하고 원문을 변형하지 않습니다. 요청 객체의 자동 `toString`, 예외·SQL 파라미터 로그에 비밀번호/해시를 남기지 않습니다.
- 인증 필터·로그인·JWT·refresh token은 도입하지 않습니다. 공개 API의 접근 동작은 그대로 유지합니다.
- 중복 이메일은 기존 COMMON 영역의 `COMMON_EMAIL_ALREADY_EXISTS`(409)로 표현합니다. 공통 에러 구조와 추적 ID를 유지합니다.
- 기존 Flyway 파일은 수정하지 않고 새 마이그레이션을 추가합니다. 중복 이메일 제약 위반은 롤백 후 409로 변환하고 관련 없는 DB 실패는 중복으로 숨기지 않습니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 공통 회원에 필수 비밀번호 컬럼 | 비밀번호 없는 소셜 회원을 담을 수 없음 |
| 모든 로그인 속성을 한 테이블의 nullable 컬럼으로 저장 | 가입 방식별 제약이 섞임. 일반 가입 정보 분리로 필수값을 명확히 유지 |
| 이메일을 회원 PK로 사용 | 이메일 변경과 제공자 이메일 중복이 내부 식별에 영향을 줌 |
| Argon2id | 유력한 대안이지만 현재 Spring 구현은 추가 암호 제공자가 필요. 이번에는 JDK 기반 PBKDF2를 선택 |
| bcrypt | UTF-8 기준 72바이트 제한 때문에 긴 Unicode 비밀번호 정책과 맞추려면 별도 제약 필요 |

## 결과

- 좋아지는 점: 일반 가입과 소셜 회원이 같은 내부 ID를 공유하고 비밀번호 정책을 한 인코더에서 관리합니다.
- 감수하는 점: 일반 가입 시 두 테이블을 하나의 트랜잭션에서 저장합니다. 해시 계산은 CPU 비용이 있으므로 구현 시 소요 시간을 측정합니다.
- 지켜야 할 것: 원문·해시를 응답/로그에 노출하지 않고, 로그인 추가 시 같은 인코더 설정을 재사용합니다.
- 이메일 소유 확인은 이번 범위에서 제외하고 입력 정책은 API 명세를 따릅니다. 기획 결정의 노션 결정 로그 링크는 추후 연결합니다.

## 다시 볼 때

- 소셜 계정 연결, 이메일 변경·확인, 비밀번호 재설정을 도입할 때
- 실제 배포 환경에서 해시 성능과 공개 가입 요청 제한을 정할 때
- 비밀번호 저장 권고나 비용 설정을 변경할 때

## 근거

- [Spring Security Password Storage](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
