-- 문장·표 변경(2.5). docs/erd.md와 같다.
-- 원문을 받지 못하거나 일부만 읽었으면 분석은 재무 결과로 완료하되 문장 비교 상태(text_status)에 사유를 남긴다.
ALTER TABLE analysis ADD COLUMN text_status VARCHAR(20);
ALTER TABLE analysis ADD COLUMN text_message VARCHAR(500);

CREATE TABLE text_change (
    id                  BIGINT         NOT NULL AUTO_INCREMENT,
    analysis_id         BIGINT         NOT NULL,
    change_no           INT            NOT NULL,
    change_type         VARCHAR(20)    NOT NULL,
    block_type          VARCHAR(10)    NOT NULL,
    numbers_only        BOOLEAN        NOT NULL DEFAULT FALSE,
    section_status      VARCHAR(20)    NOT NULL,
    section_title       VARCHAR(500)   NOT NULL,
    section_path        VARCHAR(1000)  NOT NULL,
    previous_rcept_no   VARCHAR(14),
    previous_section_no INT,
    previous_block_no   INT,
    previous_text       MEDIUMTEXT,
    current_rcept_no    VARCHAR(14),
    current_section_no  INT,
    current_block_no    INT,
    current_text        MEDIUMTEXT,
    similarity          DECIMAL(6, 4),
    review_reason       VARCHAR(500),
    CONSTRAINT pk_text_change PRIMARY KEY (id),
    CONSTRAINT uk_text_change_no UNIQUE (analysis_id, change_no),
    CONSTRAINT fk_text_change_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_text_change_type ON text_change (analysis_id, change_type, change_no);
