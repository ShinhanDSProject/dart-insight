CREATE TABLE social_account (
    id BIGINT AUTO_INCREMENT NOT NULL,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(254) NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_social_account PRIMARY KEY (id),
    CONSTRAINT fk_social_account_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT uk_social_account_provider_user UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_social_account_user ON social_account (user_id);
