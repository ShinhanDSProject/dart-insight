package com.dartinsight.community.domain;

/** 글·댓글 상태(docs/erd.md 커뮤니티). BLINDED는 관리자만 정한다(#461). */
public enum ContentStatus {
    VISIBLE,
    BLINDED,
    DELETED;

    /** 보일 본문: 지운 글은 아무에게도, 가린 글은 작성자에게만 */
    public String shownBody(String body, boolean mine) {
        return switch (this) {
            case VISIBLE -> body;
            case BLINDED -> mine ? body : null;
            case DELETED -> null;
        };
    }
}
