-- AI 기업 브리핑(1.2, FS-49, ADR-0025). docs/erd.md company_briefing과 같다.
-- 보고서·프롬프트 버전마다 하나만 저장하고 다시 만들지 않는다. 문장은 모델·프롬프트 버전·생성 시각과 함께 남긴다.
CREATE TABLE company_briefing (
    id             BIGINT         NOT NULL AUTO_INCREMENT,
    rcept_no       VARCHAR(14)    NOT NULL,
    prompt_version VARCHAR(30)    NOT NULL,
    status         VARCHAR(20)    NOT NULL,
    sentences      MEDIUMTEXT     NOT NULL,
    review_reason  VARCHAR(500),
    blocked_rules  VARCHAR(200),
    model          VARCHAR(100),
    generated_at   DATETIME(6),
    trace_id       VARCHAR(64),
    created_at     DATETIME(6)    NOT NULL,
    CONSTRAINT pk_company_briefing PRIMARY KEY (id),
    CONSTRAINT uk_company_briefing UNIQUE (rcept_no, prompt_version),
    CONSTRAINT fk_company_briefing_report FOREIGN KEY (rcept_no) REFERENCES report (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 브리핑의 LLM 호출도 llm_call에 남긴다(AI 사용 현황이 한 표에서 센다). 분석에 속하지 않으므로 analysis_id는 null이다
ALTER TABLE llm_call MODIFY analysis_id BIGINT NULL;
ALTER TABLE llm_call ADD COLUMN company_briefing_id BIGINT;
ALTER TABLE llm_call ADD CONSTRAINT fk_llm_call_briefing FOREIGN KEY (company_briefing_id)
    REFERENCES company_briefing (id);
CREATE INDEX idx_llm_call_briefing ON llm_call (company_briefing_id);
