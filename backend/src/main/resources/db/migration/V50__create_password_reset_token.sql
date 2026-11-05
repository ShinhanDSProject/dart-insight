-- 6.8 비밀번호 재설정 링크(ADR-0055). 토큰 원문은 메일에만 있고 SHA-256 해시만 저장한다.
CREATE TABLE password_reset_token (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(43) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_password_reset_token PRIMARY KEY (id),
    CONSTRAINT fk_password_reset_token_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT uk_password_reset_token_hash UNIQUE (token_hash),
    INDEX idx_password_reset_token_user (user_id, created_at)
) DEFAULT CHARSET = ascii COLLATE = ascii_bin;
