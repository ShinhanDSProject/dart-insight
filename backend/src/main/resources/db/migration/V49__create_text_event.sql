-- 주요 사건(3.36, #646, ADR-0050). docs/erd.md와 같다.
-- 분석이 끝난 뒤 따로 만드는 AI 결과라 분석·문장 변경 표를 고치지 않는다. 실패한 실행도 남기고 다시 시작하면 새 행을 만든다.
-- 변경은 related_disclosure처럼 (분석, change_no)로 가리킨다.
CREATE TABLE text_event_run (
    id                  BIGINT      NOT NULL AUTO_INCREMENT,
    analysis_id         BIGINT      NOT NULL,
    event_version       VARCHAR(20) NOT NULL,
    attempt_no          INT         NOT NULL,
    status              VARCHAR(20) NOT NULL,
    not_created_reason  VARCHAR(30),
    error_code          VARCHAR(50),
    dropped_event_count INT         NOT NULL DEFAULT 0,
    trace_id            VARCHAR(64),
    created_at          DATETIME(6) NOT NULL,
    started_at          DATETIME(6),
    finished_at         DATETIME(6),
    CONSTRAINT pk_text_event_run PRIMARY KEY (id),
    CONSTRAINT uk_text_event_run UNIQUE (analysis_id, event_version, attempt_no),
    CONSTRAINT fk_text_event_run_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE text_event (
    id                        BIGINT         NOT NULL AUTO_INCREMENT,
    run_id                    BIGINT         NOT NULL,
    sort_order                INT            NOT NULL,
    title                     VARCHAR(200)   NOT NULL,
    kind                      VARCHAR(30)    NOT NULL,
    scale_amount              BIGINT,
    scale_amount_text         VARCHAR(100),
    currency                  VARCHAR(3),
    scale_amount_krw          BIGINT,
    scale_ratio               DECIMAL(20, 6),
    scale_not_computed_reason VARCHAR(30),
    scale_evidence_id         VARCHAR(40),
    amount_source             VARCHAR(20)    NOT NULL,
    fx_source                 VARCHAR(20),
    fx_rate_date              DATE,
    sort_basis                VARCHAR(20)    NOT NULL,
    model                     VARCHAR(100)   NOT NULL,
    prompt_version            VARCHAR(30)    NOT NULL,
    generated_at              DATETIME(6)    NOT NULL,
    CONSTRAINT pk_text_event PRIMARY KEY (id),
    CONSTRAINT uk_text_event UNIQUE (run_id, sort_order),
    CONSTRAINT fk_text_event_run FOREIGN KEY (run_id) REFERENCES text_event_run (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE text_event_change (
    id        BIGINT NOT NULL AUTO_INCREMENT,
    event_id  BIGINT NOT NULL,
    change_no INT    NOT NULL,
    CONSTRAINT pk_text_event_change PRIMARY KEY (id),
    CONSTRAINT uk_text_event_change UNIQUE (event_id, change_no),
    CONSTRAINT fk_text_event_change_event FOREIGN KEY (event_id) REFERENCES text_event (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE text_event_quote (
    id         BIGINT        NOT NULL AUTO_INCREMENT,
    event_id   BIGINT        NOT NULL,
    quote_no   INT           NOT NULL,
    change_no  INT           NOT NULL,
    purpose    VARCHAR(10)   NOT NULL,
    side       VARCHAR(10)   NOT NULL,
    rcept_no   VARCHAR(14)   NOT NULL,
    section_no INT,
    block_no   INT           NOT NULL,
    quote_text VARCHAR(2000) NOT NULL,
    CONSTRAINT pk_text_event_quote PRIMARY KEY (id),
    CONSTRAINT uk_text_event_quote UNIQUE (event_id, quote_no),
    CONSTRAINT fk_text_event_quote_event FOREIGN KEY (event_id) REFERENCES text_event (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE text_event_unbound_change (
    id        BIGINT NOT NULL AUTO_INCREMENT,
    run_id    BIGINT NOT NULL,
    change_no INT    NOT NULL,
    CONSTRAINT pk_text_event_unbound_change PRIMARY KEY (id),
    CONSTRAINT uk_text_event_unbound_change UNIQUE (run_id, change_no),
    CONSTRAINT fk_text_event_unbound_change_run FOREIGN KEY (run_id) REFERENCES text_event_run (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
