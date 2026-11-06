-- 사건 신호와 사건 문장(3.40, #736, ADR-0060). docs/erd.md와 같다.
-- 사건 버전 event-4부터 채운다. event-3까지의 행은 고치지 않고 새 칸은 null로 둔다(조회는 현재 버전만 함).
-- signal은 MariaDB 예약어라 SQL에서 `signal`로 감싼다.
ALTER TABLE text_event_run ADD COLUMN signal_table_version VARCHAR(30);
ALTER TABLE text_event ADD COLUMN kind_code VARCHAR(40);
ALTER TABLE text_event ADD COLUMN change_code VARCHAR(40);
ALTER TABLE text_event ADD COLUMN change_name VARCHAR(50);
ALTER TABLE text_event ADD COLUMN `signal` VARCHAR(10);
ALTER TABLE text_event ADD COLUMN hold_reason VARCHAR(30);
ALTER TABLE text_event ADD COLUMN signal_evidence_id VARCHAR(40);
ALTER TABLE text_event ADD COLUMN rows_changed INT;
ALTER TABLE text_event ADD COLUMN rows_added INT;
ALTER TABLE text_event ADD COLUMN rows_missing INT;
ALTER TABLE text_event ADD COLUMN glossary MEDIUMTEXT;
ALTER TABLE text_event ADD COLUMN fact_accounts VARCHAR(1000);

CREATE TABLE text_event_sentence (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    event_id       BIGINT       NOT NULL,
    part           VARCHAR(20)  NOT NULL,
    status         VARCHAR(20)  NOT NULL,
    fail_reason    VARCHAR(30),
    items          MEDIUMTEXT   NOT NULL,
    model          VARCHAR(100),
    prompt_version VARCHAR(40),
    generated_at   DATETIME(6),
    CONSTRAINT pk_text_event_sentence PRIMARY KEY (id),
    CONSTRAINT uk_text_event_sentence UNIQUE (event_id, part),
    CONSTRAINT fk_text_event_sentence_event FOREIGN KEY (event_id) REFERENCES text_event (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
