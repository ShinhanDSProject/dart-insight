-- 근거 기반 요약(3.2)과 LLM 호출 기록(0.7). docs/erd.md와 같다.
-- 사실 문장(수치)은 코드가 만들고, AI가 만든 문장(ai_text)에는 모델·프롬프트 버전·생성 시각을 함께 남긴다.
ALTER TABLE analysis ADD COLUMN summary_status VARCHAR(20);
ALTER TABLE analysis ADD COLUMN summary_message VARCHAR(500);

CREATE TABLE summary_item (
    id                  BIGINT         NOT NULL AUTO_INCREMENT,
    analysis_id         BIGINT         NOT NULL,
    item_no             INT            NOT NULL,
    kind                VARCHAR(10)    NOT NULL,
    status              VARCHAR(20)    NOT NULL,
    fact_sentence       VARCHAR(500),
    ai_text             VARCHAR(1000),
    explanation_status  VARCHAR(20),
    evidence_ids        VARCHAR(2000),
    financial_change_id BIGINT,
    text_change_no      INT,
    review_reason       VARCHAR(500),
    model               VARCHAR(100),
    prompt_version      VARCHAR(30),
    generated_at        DATETIME(6),
    CONSTRAINT pk_summary_item PRIMARY KEY (id),
    CONSTRAINT uk_summary_item_no UNIQUE (analysis_id, item_no),
    CONSTRAINT fk_summary_item_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id),
    CONSTRAINT fk_summary_item_financial FOREIGN KEY (financial_change_id) REFERENCES financial_change (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE llm_call (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    analysis_id    BIGINT        NOT NULL,
    task           VARCHAR(30)   NOT NULL,
    provider       VARCHAR(30)   NOT NULL,
    model          VARCHAR(100)  NOT NULL,
    prompt_version VARCHAR(30)   NOT NULL,
    called_at      DATETIME(6),
    trace_id       VARCHAR(64),
    input_tokens   INT,
    output_tokens  INT,
    latency_ms     INT           NOT NULL,
    attempt        INT           NOT NULL,
    outcome        VARCHAR(20)   NOT NULL,
    error          VARCHAR(500),
    CONSTRAINT pk_llm_call PRIMARY KEY (id),
    CONSTRAINT fk_llm_call_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_llm_call_analysis ON llm_call (analysis_id);
