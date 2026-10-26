-- 보고서별 주요계정(1.2, FS-46). OpenDART 단일회사 주요계정(fnlttSinglAcnt.json)을 부른 결과와 계정 값. docs/erd.md와 같다.
-- 보고서(접수번호)마다 한 번 받으면 다시 받지 않는다(ADR-0024). 013(자료 없음)도 NO_DATA로 남기고, 호출 실패는 남기지 않는다.
CREATE TABLE report_key_account_fetch (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    rcept_no        VARCHAR(14) NOT NULL,
    status          VARCHAR(10) NOT NULL,
    source_rcept_no VARCHAR(14),
    fetched_at      DATETIME(6) NOT NULL,
    CONSTRAINT pk_report_key_account_fetch PRIMARY KEY (id),
    CONSTRAINT uk_key_account_fetch UNIQUE (rcept_no),
    CONSTRAINT fk_key_account_fetch_report FOREIGN KEY (rcept_no) REFERENCES report (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE report_key_account (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    rcept_no          VARCHAR(14)  NOT NULL,
    fs_div            VARCHAR(3)   NOT NULL,
    account_key       VARCHAR(30)  NOT NULL,
    sj_div            VARCHAR(5)   NOT NULL,
    account_name      VARCHAR(200) NOT NULL,
    ord               INT,
    amount            BIGINT,
    cumulative_amount BIGINT,
    currency          VARCHAR(10),
    fetched_at        DATETIME(6)  NOT NULL,
    CONSTRAINT pk_report_key_account PRIMARY KEY (id),
    CONSTRAINT uk_key_account UNIQUE (rcept_no, fs_div, account_key),
    CONSTRAINT fk_key_account_report FOREIGN KEY (rcept_no) REFERENCES report (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
