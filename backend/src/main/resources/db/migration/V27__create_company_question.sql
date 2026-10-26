-- 기업 개요 탭에서 최신 사업보고서에 한 질문과 AI 답(1.2, FS-53, ADR-0029). docs/erd.md company_question과 같다.
-- 질문은 사용자와 묶지 않는다. 답은 모델·프롬프트 버전·생성 시각과 함께 남긴다.
CREATE TABLE company_question (
    id             BIGINT         NOT NULL AUTO_INCREMENT,
    rcept_no       VARCHAR(14)    NOT NULL,
    question       VARCHAR(400)   NOT NULL,
    status         VARCHAR(20)    NOT NULL,
    answer         VARCHAR(1000),
    evidence_ids   VARCHAR(2000),
    review_reason  VARCHAR(500),
    blocked_rules  VARCHAR(200),
    model          VARCHAR(100),
    prompt_version VARCHAR(30),
    generated_at   DATETIME(6),
    trace_id       VARCHAR(64),
    created_at     DATETIME(6)    NOT NULL,
    CONSTRAINT pk_company_question PRIMARY KEY (id),
    CONSTRAINT fk_company_question_report FOREIGN KEY (rcept_no) REFERENCES report (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_company_question_report ON company_question (rcept_no, id);

-- 기업 질문의 LLM 호출도 llm_call(task answer)에 남긴다. 분석에 속하지 않으므로 analysis_id는 null이다
ALTER TABLE llm_call ADD COLUMN company_question_id BIGINT;
ALTER TABLE llm_call ADD CONSTRAINT fk_llm_call_company_question FOREIGN KEY (company_question_id)
    REFERENCES company_question (id);
CREATE INDEX idx_llm_call_company_question ON llm_call (company_question_id);
