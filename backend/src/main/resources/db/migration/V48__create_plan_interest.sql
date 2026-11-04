-- 요금제 '관심 있어요'(3.34, FS-73). 결제 전에 요금제별 수요를 센다. docs/erd.md의 plan_interest와 같다.
-- 로그인하지 않고 누르면 user_id가 null이고, 회원을 지우면 null로 둔다(개인정보는 넣지 않음).
CREATE TABLE plan_interest (
    id         BIGINT AUTO_INCREMENT NOT NULL,
    plan       VARCHAR(10) NOT NULL,
    source     VARCHAR(40) NOT NULL,
    user_id    BIGINT      NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_plan_interest PRIMARY KEY (id),
    CONSTRAINT fk_plan_interest_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE SET NULL
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_plan_interest_created_plan ON plan_interest (created_at, plan);
