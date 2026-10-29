-- 커뮤니티 글에 붙인 변경점 인용(6.6 #464, FS-58). docs/erd.md와 같다.
-- 판단 노트(ADR-0034)처럼 담을 때의 이름·글은 사본으로, 원래 위치(분석·변경)는 참조로 둔다(외래 키 없음).
CREATE TABLE community_quote (
    id                   BIGINT        NOT NULL AUTO_INCREMENT,
    post_id              BIGINT        NOT NULL,
    kind                 VARCHAR(20)   NOT NULL,
    analysis_id          BIGINT        NOT NULL,
    analysis_version     VARCHAR(20)   NOT NULL,
    change_id            BIGINT        NOT NULL,
    sj_div               VARCHAR(5),
    change_type          VARCHAR(20),
    rcept_no             VARCHAR(14)   NOT NULL,
    section_no           INT,
    block_no             INT,
    previous_report_name VARCHAR(200)  NOT NULL,
    current_report_name  VARCHAR(200)  NOT NULL,
    snapshot_label       VARCHAR(1000) NOT NULL,
    snapshot_text        VARCHAR(1000) NOT NULL,
    created_at           DATETIME(6)   NOT NULL,
    CONSTRAINT pk_community_quote PRIMARY KEY (id),
    CONSTRAINT uk_community_quote_post UNIQUE (post_id),
    CONSTRAINT fk_community_quote_post FOREIGN KEY (post_id) REFERENCES community_post (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
