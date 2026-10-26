-- 회원별 관심 기업(6.2, #36). docs/erd.md의 favorite_company와 같다.
CREATE TABLE favorite_company (
    id         BIGINT AUTO_INCREMENT NOT NULL,
    user_id    BIGINT      NOT NULL,
    corp_code  VARCHAR(8)  NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_favorite_company PRIMARY KEY (id),
    CONSTRAINT fk_favorite_company_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT fk_favorite_company_company FOREIGN KEY (corp_code) REFERENCES company (corp_code),
    CONSTRAINT uk_favorite_company_user_corp UNIQUE (user_id, corp_code)
-- corp_code 외래 키는 company와 문자셋·정렬이 같아야 MariaDB가 받는다(errno 150)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
