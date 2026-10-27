-- 판단 노트 항목(6.5, #413, FS-57, ADR-0034). docs/erd.md의 judgment_note_item과 같다.
-- 담을 때의 이름·값·문장(사본)과 원래 위치(참조)를 함께 둔다. 분석·변경 ID는 참조라 외래 키를 두지 않는다.
CREATE TABLE judgment_note_item (
    id               BIGINT AUTO_INCREMENT NOT NULL,
    user_id          BIGINT        NOT NULL,
    corp_code        VARCHAR(8)    NOT NULL,
    kind             VARCHAR(20)   NOT NULL,
    analysis_id      BIGINT,
    analysis_version VARCHAR(20),
    change_id        BIGINT,
    sj_div           VARCHAR(5),
    rcept_no         VARCHAR(14),
    section_no       INT,
    block_no         INT,
    change_type      VARCHAR(20),
    snapshot_label   VARCHAR(1000) NOT NULL,
    snapshot_text    VARCHAR(4000) NOT NULL,
    memo             VARCHAR(1000),
    created_at       DATETIME(6)   NOT NULL,
    updated_at       DATETIME(6)   NOT NULL,
    CONSTRAINT pk_judgment_note_item PRIMARY KEY (id),
    CONSTRAINT fk_judgment_note_item_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT fk_judgment_note_item_company FOREIGN KEY (corp_code) REFERENCES company (corp_code)
-- corp_code 외래 키는 company와 문자셋·정렬이 같아야 MariaDB가 받는다(errno 150)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_judgment_note_item_user_corp ON judgment_note_item (user_id, corp_code, created_at);
