-- 기업 개황(1.2, #329). OpenDART company.json에서 받은 값의 캐시. docs/erd.md의 company_overview와 같다.
-- 받은 시각(fetched_at)으로 다시 받을지 정한다(ADR-0024). 013(자료 없음)은 status = 'NO_DATA'.
CREATE TABLE company_overview (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    corp_code     VARCHAR(8)   NOT NULL,
    status        VARCHAR(10)  NOT NULL,
    corp_name     VARCHAR(200),
    corp_name_eng VARCHAR(200),
    stock_name    VARCHAR(200),
    stock_code    VARCHAR(6),
    ceo_nm        VARCHAR(200),
    corp_cls      VARCHAR(1),
    induty_code   VARCHAR(10),
    est_dt        DATE,
    acc_mt        INT,
    hm_url        VARCHAR(300),
    ir_url        VARCHAR(300),
    adres         VARCHAR(500),
    phn_no        VARCHAR(50),
    fetched_at    DATETIME(6)  NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    CONSTRAINT pk_company_overview PRIMARY KEY (id),
    CONSTRAINT uk_company_overview_corp_code UNIQUE (corp_code),
    CONSTRAINT fk_company_overview_company FOREIGN KEY (corp_code) REFERENCES company (corp_code)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
