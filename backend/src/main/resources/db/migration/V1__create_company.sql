-- 기업(4.4). OpenDART corpCode.xml에서 받는다. docs/erd.md의 company와 같다.
CREATE TABLE company (
    corp_code          VARCHAR(8)   NOT NULL,
    corp_name          VARCHAR(200) NOT NULL,
    corp_eng_name      VARCHAR(200),
    stock_code         VARCHAR(6),
    modify_date        DATE,
    reports_fetched_at DATETIME(6),
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    CONSTRAINT pk_company PRIMARY KEY (corp_code)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_company_corp_name ON company (corp_name);
CREATE INDEX idx_company_stock_code ON company (stock_code);
