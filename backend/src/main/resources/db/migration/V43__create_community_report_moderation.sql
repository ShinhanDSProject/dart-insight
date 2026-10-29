-- 커뮤니티 신고·관리자 처리·재게시 청구(6.6 #461, FS-58). docs/erd.md와 같다.
-- 신고만으로 글을 가리지 않는다. 관리자가 처리할 때만 상태가 바뀌고, 처리 기록은 고치거나 지우지 않는다.

-- 대상(글·댓글)마다 한 행. target_id에는 외래 키를 두지 않는다(community_like와 같은 이유)
CREATE TABLE community_report (
    id               BIGINT      NOT NULL AUTO_INCREMENT,
    target_type      VARCHAR(10) NOT NULL,
    target_id        BIGINT      NOT NULL,
    post_id          BIGINT      NOT NULL,
    status           VARCHAR(10) NOT NULL DEFAULT 'OPEN',
    report_count     INT         NOT NULL DEFAULT 0,
    blind_until      DATETIME(6),
    last_reported_at DATETIME(6) NOT NULL,
    created_at       DATETIME(6) NOT NULL,
    updated_at       DATETIME(6) NOT NULL,
    CONSTRAINT pk_community_report PRIMARY KEY (id),
    CONSTRAINT uk_community_report_target UNIQUE (target_type, target_id),
    CONSTRAINT fk_community_report_post FOREIGN KEY (post_id) REFERENCES community_post (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_community_report_status ON community_report (status, last_reported_at);

-- 회원 한 명의 신고 한 번. 같은 대상에 한 번만
CREATE TABLE community_report_entry (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    report_id   BIGINT      NOT NULL,
    reporter_id BIGINT      NOT NULL,
    reason      VARCHAR(20) NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    CONSTRAINT pk_community_report_entry PRIMARY KEY (id),
    CONSTRAINT uk_community_report_entry_reporter UNIQUE (report_id, reporter_id),
    CONSTRAINT fk_community_report_entry_report FOREIGN KEY (report_id) REFERENCES community_report (id),
    CONSTRAINT fk_community_report_entry_user FOREIGN KEY (reporter_id) REFERENCES app_user (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 관리자 처리 기록(정보통신망법 제44조의2 임시조치의 기록). 처리할 때마다 한 행을 더한다
CREATE TABLE community_moderation (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    report_id   BIGINT       NOT NULL,
    admin_id    BIGINT       NOT NULL,
    decision    VARCHAR(10)  NOT NULL,
    reason      VARCHAR(500) NOT NULL,
    blind_days  INT,
    blind_until DATETIME(6),
    created_at  DATETIME(6)  NOT NULL,
    CONSTRAINT pk_community_moderation PRIMARY KEY (id),
    CONSTRAINT fk_community_moderation_report FOREIGN KEY (report_id) REFERENCES community_report (id),
    CONSTRAINT fk_community_moderation_admin FOREIGN KEY (admin_id) REFERENCES app_user (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_community_moderation_report ON community_moderation (report_id, created_at);

-- 블라인드 처리마다 작성자의 재게시 청구 하나
CREATE TABLE community_repost_request (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    moderation_id BIGINT       NOT NULL,
    user_id       BIGINT       NOT NULL,
    message       VARCHAR(500),
    created_at    DATETIME(6)  NOT NULL,
    CONSTRAINT pk_community_repost_request PRIMARY KEY (id),
    CONSTRAINT uk_community_repost_request_moderation UNIQUE (moderation_id),
    CONSTRAINT fk_community_repost_request_moderation FOREIGN KEY (moderation_id)
        REFERENCES community_moderation (id),
    CONSTRAINT fk_community_repost_request_user FOREIGN KEY (user_id) REFERENCES app_user (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
