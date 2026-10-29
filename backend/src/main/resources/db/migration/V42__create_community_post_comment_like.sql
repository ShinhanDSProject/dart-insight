-- 커뮤니티 글·댓글·좋아요(6.6 #460, FS-58). docs/erd.md와 같다.
-- 신고·처리(#461)와 변경점 인용(#464)은 각 이슈의 마이그레이션에서 더한다.
CREATE TABLE community_post (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    corp_code     VARCHAR(8)    NOT NULL,
    user_id       BIGINT        NOT NULL,
    body          VARCHAR(2000) NOT NULL,
    status        VARCHAR(10)   NOT NULL DEFAULT 'VISIBLE',
    like_count    INT           NOT NULL DEFAULT 0,
    comment_count INT           NOT NULL DEFAULT 0,
    created_at    DATETIME(6)   NOT NULL,
    edited_at     DATETIME(6),
    deleted_at    DATETIME(6),
    CONSTRAINT pk_community_post PRIMARY KEY (id),
    CONSTRAINT fk_community_post_company FOREIGN KEY (corp_code) REFERENCES company (corp_code),
    CONSTRAINT fk_community_post_user FOREIGN KEY (user_id) REFERENCES app_user (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_community_post_corp_created ON community_post (corp_code, created_at);

CREATE TABLE community_comment (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    post_id    BIGINT       NOT NULL,
    parent_id  BIGINT,
    user_id    BIGINT       NOT NULL,
    body       VARCHAR(500) NOT NULL,
    status     VARCHAR(10)  NOT NULL DEFAULT 'VISIBLE',
    like_count INT          NOT NULL DEFAULT 0,
    created_at DATETIME(6)  NOT NULL,
    edited_at  DATETIME(6),
    deleted_at DATETIME(6),
    CONSTRAINT pk_community_comment PRIMARY KEY (id),
    CONSTRAINT fk_community_comment_post FOREIGN KEY (post_id) REFERENCES community_post (id),
    CONSTRAINT fk_community_comment_parent FOREIGN KEY (parent_id) REFERENCES community_comment (id),
    CONSTRAINT fk_community_comment_user FOREIGN KEY (user_id) REFERENCES app_user (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_community_comment_post ON community_comment (post_id, created_at);

-- 대상이 글·댓글 두 표라 target_id에는 외래 키를 두지 않는다(글·댓글은 지워도 행이 남아 끊기지 않음)
CREATE TABLE community_like (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    target_type VARCHAR(10) NOT NULL,
    target_id   BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    CONSTRAINT pk_community_like PRIMARY KEY (id),
    CONSTRAINT uk_community_like_target_user UNIQUE (target_type, target_id, user_id),
    CONSTRAINT fk_community_like_user FOREIGN KEY (user_id) REFERENCES app_user (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
