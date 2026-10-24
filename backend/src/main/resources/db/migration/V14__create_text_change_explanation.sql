-- 문장 변경 AI 한 줄 풀이(3.11, FS-6). docs/erd.md text_change_explanation과 같다.
-- 분석·변경마다 하나만 저장하고 다시 만들지 않는다. AI 풀이는 모델·프롬프트 버전·생성 시각과 함께 남긴다.
CREATE TABLE text_change_explanation (
    id             BIGINT         NOT NULL AUTO_INCREMENT,
    analysis_id    BIGINT         NOT NULL,
    change_no      INT            NOT NULL,
    status         VARCHAR(20)    NOT NULL,
    sentence       VARCHAR(1000),
    evidence_ids   VARCHAR(500),
    review_reason  VARCHAR(500),
    blocked_rules  VARCHAR(200),
    model          VARCHAR(100),
    prompt_version VARCHAR(30),
    generated_at   DATETIME(6),
    trace_id       VARCHAR(64),
    created_at     DATETIME(6)    NOT NULL,
    CONSTRAINT pk_text_change_explanation PRIMARY KEY (id),
    CONSTRAINT uk_text_change_explanation UNIQUE (analysis_id, change_no),
    CONSTRAINT fk_text_change_explanation_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
