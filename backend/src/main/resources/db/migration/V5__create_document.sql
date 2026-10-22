-- 보고서 원문 구조화(4.2). docs/erd.md와 같다.
-- 보고서(접수번호)마다 구조화 기록 하나와, 목차(섹션)·문단·표(블록)를 둔다. 원문 ZIP 자체는 디스크 캐시에 있다.
CREATE TABLE report_document (
    id                BIGINT         NOT NULL AUTO_INCREMENT,
    rcept_no          VARCHAR(14)    NOT NULL,
    status            VARCHAR(20)    NOT NULL,
    parser_version    VARCHAR(20),
    failure_code      VARCHAR(50),
    failure_message   VARCHAR(500),
    main_file         VARCHAR(200),
    encoding          VARCHAR(20),
    warnings          VARCHAR(2000),
    section_count     INT            NOT NULL DEFAULT 0,
    block_count       INT            NOT NULL DEFAULT 0,
    cell_count        INT            NOT NULL DEFAULT 0,
    source_cell_count INT            NOT NULL DEFAULT 0,
    zip_bytes         BIGINT,
    fetched_at        DATETIME(6)    NOT NULL,
    structured_at     DATETIME(6),
    CONSTRAINT pk_report_document PRIMARY KEY (id),
    CONSTRAINT uk_report_document_rcept_no UNIQUE (rcept_no),
    CONSTRAINT fk_report_document_report FOREIGN KEY (rcept_no) REFERENCES report (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE document_section (
    id          BIGINT        NOT NULL AUTO_INCREMENT,
    document_id BIGINT        NOT NULL,
    section_no  INT           NOT NULL,
    parent_no   INT,
    depth       INT           NOT NULL,
    title       VARCHAR(500)  NOT NULL,
    source_ref  VARCHAR(50),
    cover       BOOLEAN       NOT NULL DEFAULT FALSE,
    block_count INT           NOT NULL,
    CONSTRAINT pk_document_section PRIMARY KEY (id),
    CONSTRAINT uk_document_section_no UNIQUE (document_id, section_no),
    CONSTRAINT fk_document_section_document FOREIGN KEY (document_id) REFERENCES report_document (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE document_block (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    document_id BIGINT       NOT NULL,
    block_no    INT          NOT NULL,
    section_no  INT          NOT NULL,
    block_type  VARCHAR(10)  NOT NULL,
    content     MEDIUMTEXT   NOT NULL,
    table_json  MEDIUMTEXT,
    CONSTRAINT pk_document_block PRIMARY KEY (id),
    CONSTRAINT uk_document_block_no UNIQUE (document_id, block_no),
    CONSTRAINT fk_document_block_document FOREIGN KEY (document_id) REFERENCES report_document (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_document_block_section ON document_block (document_id, section_no, block_no);
