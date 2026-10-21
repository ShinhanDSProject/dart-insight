-- 재무제표(4.5). OpenDART 단일회사 전체 재무제표(fnlttSinglAcntAll.json)를 부른 결과와 계정 값. docs/erd.md와 같다.
CREATE TABLE financial_statement_fetch (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    corp_code   VARCHAR(8)  NOT NULL,
    fiscal_year INT         NOT NULL,
    reprt_code  VARCHAR(5)  NOT NULL,
    fs_div      VARCHAR(3)  NOT NULL,
    status      VARCHAR(10) NOT NULL,
    rcept_no    VARCHAR(14),
    fetched_at  DATETIME(6) NOT NULL,
    CONSTRAINT pk_financial_statement_fetch PRIMARY KEY (id),
    CONSTRAINT uk_fs_fetch UNIQUE (corp_code, fiscal_year, reprt_code, fs_div),
    CONSTRAINT fk_financial_statement_fetch_company FOREIGN KEY (corp_code) REFERENCES company (corp_code)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE financial_account (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    fetch_id          BIGINT       NOT NULL,
    rcept_no          VARCHAR(14)  NOT NULL,
    sj_div            VARCHAR(5)   NOT NULL,
    sj_name           VARCHAR(100),
    account_id        VARCHAR(200) NOT NULL,
    account_name      VARCHAR(200) NOT NULL,
    account_detail    VARCHAR(500),
    ord               INT,
    currency          VARCHAR(10),
    thstrm_name       VARCHAR(50),
    frmtrm_name       VARCHAR(50),
    thstrm_amount     BIGINT,
    thstrm_add_amount BIGINT,
    frmtrm_amount     BIGINT,
    frmtrm_q_amount   BIGINT,
    frmtrm_add_amount BIGINT,
    CONSTRAINT pk_financial_account PRIMARY KEY (id),
    CONSTRAINT fk_financial_account_fetch FOREIGN KEY (fetch_id) REFERENCES financial_statement_fetch (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_fin_account_fetch ON financial_account (fetch_id, sj_div, ord);
