-- 6.2 일반 로그인. Refresh Token 원문은 저장하지 않고 SHA-256 해시만 저장한다.
CREATE TABLE refresh_token (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(43) NOT NULL,
    family_id VARCHAR(36) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    last_used_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    replaced_by_id BIGINT NULL,
    CONSTRAINT pk_refresh_token PRIMARY KEY (id),
    CONSTRAINT fk_refresh_token_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT fk_refresh_token_replacement FOREIGN KEY (replaced_by_id) REFERENCES refresh_token (id),
    CONSTRAINT uk_refresh_token_hash UNIQUE (token_hash),
    INDEX idx_refresh_token_family (family_id)
) DEFAULT CHARSET = ascii COLLATE = ascii_bin;
