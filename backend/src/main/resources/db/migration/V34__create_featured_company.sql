-- 첫 화면 대표 기업(1.5, #399, ADR-0033). docs/erd.md의 featured_company와 같다.
CREATE TABLE featured_company (
    id         BIGINT AUTO_INCREMENT NOT NULL,
    rank_no    INT         NOT NULL,
    corp_code  VARCHAR(8)  NOT NULL,
    market_cap BIGINT      NOT NULL,
    base_date  DATE        NOT NULL,
    fetched_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_featured_company PRIMARY KEY (id),
    CONSTRAINT fk_featured_company_company FOREIGN KEY (corp_code) REFERENCES company (corp_code),
    CONSTRAINT uk_featured_company_rank UNIQUE (rank_no),
    CONSTRAINT uk_featured_company_corp_code UNIQUE (corp_code)
-- corp_code 외래 키는 company와 문자셋·정렬이 같아야 MariaDB가 받는다(errno 150)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
