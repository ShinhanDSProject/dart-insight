-- 정기보고서(4.1). OpenDART 공시검색(list.json)의 정기공시 중 사업·반기·분기보고서만 둔다. docs/erd.md의 report와 같다.
CREATE TABLE report (
    rcept_no     VARCHAR(14)  NOT NULL,
    corp_code    VARCHAR(8)   NOT NULL,
    report_name  VARCHAR(200) NOT NULL,
    report_type  VARCHAR(10)  NOT NULL,
    fiscal_year  INT          NOT NULL,
    period_end   DATE         NOT NULL,
    rcept_dt     DATE         NOT NULL,
    correction   VARCHAR(10)  NOT NULL,
    remark       VARCHAR(20),
    filer_name   VARCHAR(200),
    last_seen_at DATETIME(6)  NOT NULL,
    created_at   DATETIME(6)  NOT NULL,
    updated_at   DATETIME(6)  NOT NULL,
    CONSTRAINT pk_report PRIMARY KEY (rcept_no),
    CONSTRAINT fk_report_company FOREIGN KEY (corp_code) REFERENCES company (corp_code)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_report_corp_period ON report (corp_code, period_end);
