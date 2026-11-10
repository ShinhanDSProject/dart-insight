-- 두 보고서 사이에 회사가 한 일과 앞으로의 영향(ADR-0067). docs/erd.md period_activity와 같다.
-- 분석·프롬프트 버전마다 하나만 저장하고 다시 만들지 않는다. 카드는 모델·프롬프트 버전·생성 시각과 함께 남긴다.
-- LLM 호출 기록은 llm_call(task period_activity)에 analysis_id만 채워 남긴다.
CREATE TABLE period_activity (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    analysis_id          BIGINT       NOT NULL,
    prompt_version       VARCHAR(30)  NOT NULL,
    status               VARCHAR(20)  NOT NULL,
    payload              MEDIUMTEXT   NOT NULL,
    review_reason        VARCHAR(500),
    blocked_rules        VARCHAR(200),
    signal_table_version VARCHAR(30),
    model                VARCHAR(100),
    generated_at         DATETIME(6),
    trace_id             VARCHAR(64),
    created_at           DATETIME(6)  NOT NULL,
    CONSTRAINT pk_period_activity PRIMARY KEY (id),
    CONSTRAINT uk_period_activity UNIQUE (analysis_id, prompt_version),
    CONSTRAINT fk_period_activity_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
