-- 정기보고서 주요정보(최대주주·임원·배당, #331). docs/erd.md와 같다.
-- 보고서(접수번호)·종류마다 OpenDART를 한 번 부른 결과. 행 목록은 backend가 정리한 JSON 배열로 둔다.
CREATE TABLE report_key_fact (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    rcept_no        VARCHAR(14) NOT NULL,
    kind            VARCHAR(30) NOT NULL,
    status          VARCHAR(10) NOT NULL,
    settlement_date DATE,
    rows_json       MEDIUMTEXT  NOT NULL,
    fetched_at      DATETIME(6) NOT NULL,
    CONSTRAINT pk_report_key_fact PRIMARY KEY (id),
    CONSTRAINT uk_report_key_fact UNIQUE (rcept_no, kind),
    CONSTRAINT fk_report_key_fact_report FOREIGN KEY (rcept_no) REFERENCES report (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
