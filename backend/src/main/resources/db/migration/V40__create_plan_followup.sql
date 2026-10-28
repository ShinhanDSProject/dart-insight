-- 약속과 실제 대조(1.10, FS-60, ADR-0041). docs/erd.md plan_followup과 같다.
-- 작년·올해 사업보고서와 프롬프트 버전마다 하나만 저장하고 다시 만들지 않는다. 계획 모습도 items에 함께 남긴다.
CREATE TABLE plan_followup (
    id                BIGINT         NOT NULL AUTO_INCREMENT,
    previous_rcept_no VARCHAR(14)    NOT NULL,
    current_rcept_no  VARCHAR(14)    NOT NULL,
    prompt_version    VARCHAR(30)    NOT NULL,
    status            VARCHAR(20)    NOT NULL,
    items             MEDIUMTEXT     NOT NULL,
    review_reason     VARCHAR(500),
    blocked_rules     VARCHAR(200),
    model             VARCHAR(100),
    generated_at      DATETIME(6),
    trace_id          VARCHAR(64),
    created_at        DATETIME(6)    NOT NULL,
    CONSTRAINT pk_plan_followup PRIMARY KEY (id),
    CONSTRAINT uk_plan_followup UNIQUE (previous_rcept_no, current_rcept_no, prompt_version),
    CONSTRAINT fk_plan_followup_previous FOREIGN KEY (previous_rcept_no) REFERENCES report (rcept_no),
    CONSTRAINT fk_plan_followup_current FOREIGN KEY (current_rcept_no) REFERENCES report (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 대조의 LLM 호출도 llm_call(task plan_followup)에 남긴다. 분석에 속하지 않으므로 analysis_id는 null이다
ALTER TABLE llm_call ADD COLUMN plan_followup_id BIGINT;
ALTER TABLE llm_call ADD CONSTRAINT fk_llm_call_plan_followup FOREIGN KEY (plan_followup_id)
    REFERENCES plan_followup (id);
CREATE INDEX idx_llm_call_plan_followup ON llm_call (plan_followup_id);
