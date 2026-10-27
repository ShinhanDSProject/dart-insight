-- 회사가 밝힌 전망·계획(1.9, FS-59, ADR-0039). docs/erd.md company_outlook과 같다.
-- 보고서·프롬프트 버전마다 하나만 저장하고 다시 만들지 않는다. 항목은 모델·프롬프트 버전·생성 시각과 함께 남긴다.
CREATE TABLE company_outlook (
    id             BIGINT         NOT NULL AUTO_INCREMENT,
    rcept_no       VARCHAR(14)    NOT NULL,
    prompt_version VARCHAR(30)    NOT NULL,
    status         VARCHAR(20)    NOT NULL,
    items          MEDIUMTEXT     NOT NULL,
    review_reason  VARCHAR(500),
    blocked_rules  VARCHAR(200),
    model          VARCHAR(100),
    generated_at   DATETIME(6),
    trace_id       VARCHAR(64),
    created_at     DATETIME(6)    NOT NULL,
    CONSTRAINT pk_company_outlook PRIMARY KEY (id),
    CONSTRAINT uk_company_outlook UNIQUE (rcept_no, prompt_version),
    CONSTRAINT fk_company_outlook_report FOREIGN KEY (rcept_no) REFERENCES report (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 전망·계획의 LLM 호출도 llm_call(task outlook)에 남긴다. 분석에 속하지 않으므로 analysis_id는 null이다
ALTER TABLE llm_call ADD COLUMN company_outlook_id BIGINT;
ALTER TABLE llm_call ADD CONSTRAINT fk_llm_call_outlook FOREIGN KEY (company_outlook_id)
    REFERENCES company_outlook (id);
CREATE INDEX idx_llm_call_outlook ON llm_call (company_outlook_id);
