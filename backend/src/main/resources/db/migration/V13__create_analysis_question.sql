-- 근거로 답하는 질문(3.10, ADR-0019). docs/erd.md analysis_question과 같다.
-- 질문은 사용자와 묶지 않는다. AI 답은 모델·프롬프트 버전·생성 시각과 함께 남긴다.
CREATE TABLE analysis_question (
    id              BIGINT         NOT NULL AUTO_INCREMENT,
    analysis_id     BIGINT         NOT NULL,
    question        VARCHAR(400)   NOT NULL,
    status          VARCHAR(20)    NOT NULL,
    answer          VARCHAR(1000),
    evidence_ids    VARCHAR(2000),
    fact_change_ids VARCHAR(500),
    review_reason   VARCHAR(500),
    blocked_rules   VARCHAR(200),
    model           VARCHAR(100),
    prompt_version  VARCHAR(30),
    generated_at    DATETIME(6),
    trace_id        VARCHAR(64),
    created_at      DATETIME(6)    NOT NULL,
    CONSTRAINT pk_analysis_question PRIMARY KEY (id),
    CONSTRAINT fk_analysis_question_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_analysis_question_analysis ON analysis_question (analysis_id, id);
