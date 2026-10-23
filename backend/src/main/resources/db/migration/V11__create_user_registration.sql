-- #136 일반 회원가입. 공통 회원과 일반 가입 정보를 분리한다.
CREATE TABLE app_user (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_app_user PRIMARY KEY (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE local_credential (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_local_credential PRIMARY KEY (id),
    CONSTRAINT fk_local_credential_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT uk_local_credential_user_id UNIQUE (user_id),
    CONSTRAINT uk_local_credential_email UNIQUE (email)
) DEFAULT CHARSET = ascii COLLATE = ascii_bin;
