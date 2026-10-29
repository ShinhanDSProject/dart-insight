package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;

/**
 * 커뮤니티 글자 규칙(API 명세 6.6): 앞뒤 공백을 지운 1~2,000자(글), 1~500자(댓글·처리 사유), 0~500자(재게시 청구 말).
 * 글자 수는 코드 포인트로 센다.
 */
public final class CommunityText {
    public static final int MAX_POST = 2000;
    public static final int MAX_COMMENT = 500;
    public static final int MAX_MODERATION_REASON = 500;
    public static final int MAX_REPOST_MESSAGE = 500;

    private CommunityText() {}

    public static String postBody(Object raw) {
        return body(raw, MAX_POST, "글은 1~2,000자로 써 주세요.");
    }

    public static String commentBody(Object raw) {
        return body(raw, MAX_COMMENT, "댓글은 1~500자로 써 주세요.");
    }

    /** 관리자 처리 사유: 앞뒤 공백을 지운 1~500자 */
    public static String moderationReason(Object raw) {
        return text(raw, "reason", MAX_MODERATION_REASON, "처리 사유는 1~500자로 써 주세요.");
    }

    /** 재게시 청구에 남기는 말: 없어도 되고, 앞뒤 공백을 지워 비었으면 null, 500자까지 */
    public static String repostMessage(Object raw) {
        if (raw == null || raw instanceof String value && value.isBlank()) return null;
        return text(raw, "message", MAX_REPOST_MESSAGE, "남길 말은 500자까지 써 주세요.");
    }

    private static String body(Object raw, int max, String reason) {
        return text(raw, "body", max, reason);
    }

    private static String text(Object raw, String field, int max, String reason) {
        if (!(raw instanceof String value)) throw ApiException.invalidInput(field, reason);
        String text = value.strip();
        int length = text.codePointCount(0, text.length());
        if (length < 1 || length > max) throw ApiException.invalidInput(field, reason);
        return text;
    }
}
