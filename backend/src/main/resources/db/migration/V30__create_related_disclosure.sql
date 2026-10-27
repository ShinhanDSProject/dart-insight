-- 관련 수시공시(3.6, #340, ADR-0030)의 연결 계산 결과. docs/erd.md와 같다.
-- 분석·규칙 버전마다 한 번 계산해 저장하고(연결 0건도 저장), 규칙 버전이 바뀌면 다음 요청 때 새로 계산한다.
-- 변경은 text_change_explanation처럼 (분석, change_no)로, 공시는 disclosure_window_item.id로 가리킨다.
CREATE TABLE related_disclosure_run (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    analysis_id     BIGINT      NOT NULL,
    rule_version    VARCHAR(20) NOT NULL,
    window_fetch_id BIGINT      NOT NULL,
    period_end      DATE        NOT NULL,
    link_count      INT         NOT NULL,
    trace_id        VARCHAR(64),
    computed_at     DATETIME(6) NOT NULL,
    CONSTRAINT pk_related_disclosure_run PRIMARY KEY (id),
    CONSTRAINT uk_related_disclosure_run UNIQUE (analysis_id, rule_version),
    CONSTRAINT fk_related_disclosure_run_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id),
    CONSTRAINT fk_related_disclosure_run_window FOREIGN KEY (window_fetch_id)
        REFERENCES disclosure_window_fetch (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE related_disclosure (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    run_id          BIGINT       NOT NULL,
    change_no       INT          NOT NULL,
    item_id         BIGINT       NOT NULL,
    latest_rcept_no VARCHAR(14),
    timing          VARCHAR(10)  NOT NULL,
    match_rule      VARCHAR(30)  NOT NULL,
    match_level     VARCHAR(10)  NOT NULL,
    matched_fields  VARCHAR(100),
    CONSTRAINT pk_related_disclosure PRIMARY KEY (id),
    CONSTRAINT uk_related_disclosure UNIQUE (run_id, change_no, item_id),
    CONSTRAINT fk_related_disclosure_run FOREIGN KEY (run_id) REFERENCES related_disclosure_run (id),
    CONSTRAINT fk_related_disclosure_item FOREIGN KEY (item_id) REFERENCES disclosure_window_item (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
