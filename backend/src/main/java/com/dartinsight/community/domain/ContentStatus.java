package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;

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

    /**
     * 관리자 처리 뒤 상태(API 명세 PATCH /api/admin/reports/{reportId}). 유지는 가린 것만 풀고, 지운 것은 다시 살리지 않는다.
     * 이미 지운 대상은 가릴 수 없다(409).
     */
    public ContentStatus moderated(ModerationDecision decision) {
        return switch (decision) {
            case KEEP -> this == BLINDED ? VISIBLE : this;
            case BLIND -> {
                if (this == DELETED) throw new ApiException(ErrorCode.COMMUNITY_TARGET_UNAVAILABLE);
                yield BLINDED;
            }
            case DELETE -> DELETED;
        };
    }
}
