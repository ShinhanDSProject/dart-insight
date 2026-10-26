-- 기업별 최근 공시 목록 캐시(#332). OpenDART 공시검색(list.json)을 공시유형 없이 받은 결과다. docs/erd.md와 같다.
-- 받은 시각(fetched_at)이 정한 시간보다 오래되면 다시 받아 그 기업의 행을 통째로 바꾼다(ADR-0024).
CREATE TABLE company_disclosure_fetch (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    corp_code  VARCHAR(8)  NOT NULL,
    from_date  DATE        NOT NULL,
    to_date    DATE        NOT NULL,
    fetched_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_company_disclosure_fetch PRIMARY KEY (id),
    CONSTRAINT uk_company_disclosure_fetch UNIQUE (corp_code),
    CONSTRAINT fk_company_disclosure_fetch_company FOREIGN KEY (corp_code) REFERENCES company (corp_code)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE company_disclosure (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    corp_code   VARCHAR(8)   NOT NULL,
    rcept_no    VARCHAR(14)  NOT NULL,
    report_name VARCHAR(500) NOT NULL,
    filer_name  VARCHAR(200),
    rcept_dt    DATE         NOT NULL,
    remark      VARCHAR(20),
    created_at  DATETIME(6)  NOT NULL,
    CONSTRAINT pk_company_disclosure PRIMARY KEY (id),
    CONSTRAINT uk_company_disclosure UNIQUE (corp_code, rcept_no),
    CONSTRAINT fk_company_disclosure_company FOREIGN KEY (corp_code) REFERENCES company (corp_code)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_company_disclosure_date ON company_disclosure (corp_code, rcept_dt);
