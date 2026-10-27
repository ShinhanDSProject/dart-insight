-- 이번 시즌 변화가 큰 기업(1.7, #420, ADR-0037). docs/erd.md의 season_change와 같다.
CREATE TABLE season_change (
    id                BIGINT AUTO_INCREMENT NOT NULL,
    report_type       VARCHAR(10)   NOT NULL,
    fiscal_year       INT           NOT NULL,
    corp_code         VARCHAR(8)    NOT NULL,
    status            VARCHAR(20)   NOT NULL,
    previous_rcept_no VARCHAR(14),
    current_rcept_no  VARCHAR(14),
    score             DECIMAL(12, 2),
    change_count      INT,
    highlight         VARCHAR(300),
    rank_no           INT,
    analysis_id       BIGINT,
    reason            VARCHAR(500),
    score_version     VARCHAR(20)   NOT NULL,
    candidate_count   INT           NOT NULL,
    computed_at       DATETIME(6)   NOT NULL,
    CONSTRAINT pk_season_change PRIMARY KEY (id),
    CONSTRAINT fk_season_change_company FOREIGN KEY (corp_code) REFERENCES company (corp_code),
    CONSTRAINT fk_season_change_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id),
    CONSTRAINT uk_season_change_season_corp UNIQUE (report_type, fiscal_year, corp_code)
-- corp_code 외래 키는 company와 문자셋·정렬이 같아야 MariaDB가 받는다(errno 150)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
