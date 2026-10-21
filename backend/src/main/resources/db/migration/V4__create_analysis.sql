-- 분석 작업과 재무 수치 비교 결과(4.3). docs/erd.md와 같다.
-- 같은 기업·보고서 쌍·비교 기준·분석 버전의 결과는 다시 쓰고, 정정 공시(다른 접수번호)는 새 분석으로 만든다.
CREATE TABLE analysis (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    corp_code         VARCHAR(8)   NOT NULL,
    current_rcept_no  VARCHAR(14)  NOT NULL,
    previous_rcept_no VARCHAR(14)  NOT NULL,
    basis             VARCHAR(10)  NOT NULL,
    analysis_version  VARCHAR(20)  NOT NULL,
    fs_div            VARCHAR(3),
    status            VARCHAR(10)  NOT NULL,
    step              VARCHAR(20)  NOT NULL,
    error_code        VARCHAR(50),
    error_message     VARCHAR(500),
    request_trace_id  VARCHAR(64),
    created_at        DATETIME(6)  NOT NULL,
    updated_at        DATETIME(6)  NOT NULL,
    started_at        DATETIME(6),
    completed_at      DATETIME(6),
    version           BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT pk_analysis PRIMARY KEY (id),
    CONSTRAINT fk_analysis_company FOREIGN KEY (corp_code) REFERENCES company (corp_code),
    CONSTRAINT fk_analysis_current_report FOREIGN KEY (current_rcept_no) REFERENCES report (rcept_no),
    CONSTRAINT fk_analysis_previous_report FOREIGN KEY (previous_rcept_no) REFERENCES report (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_analysis_key ON analysis (corp_code, current_rcept_no, previous_rcept_no, basis, analysis_version);

CREATE TABLE financial_change (
    id                   BIGINT         NOT NULL AUTO_INCREMENT,
    analysis_id          BIGINT         NOT NULL,
    sj_div               VARCHAR(5)     NOT NULL,
    fs_div               VARCHAR(3)     NOT NULL,
    account_key          VARCHAR(1000)  NOT NULL,
    account_name         VARCHAR(200)   NOT NULL,
    display_order        INT            NOT NULL,
    amount_basis         VARCHAR(10),
    previous_amount      BIGINT,
    current_amount       BIGINT,
    change_amount        BIGINT,
    change_rate          DECIMAL(20, 6),
    calc_status          VARCHAR(20)    NOT NULL,
    currency             VARCHAR(10),
    previous_rcept_no    VARCHAR(14),
    current_rcept_no     VARCHAR(14),
    previous_account_id  VARCHAR(200),
    current_account_id   VARCHAR(200),
    previous_period_name VARCHAR(50),
    current_period_name  VARCHAR(50),
    CONSTRAINT pk_financial_change PRIMARY KEY (id),
    CONSTRAINT fk_financial_change_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_fin_change_analysis ON financial_change (analysis_id, sj_div, display_order);
