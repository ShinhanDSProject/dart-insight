package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;

/** 글·댓글 본문 규칙(API 명세 6.6): 앞뒤 공백을 지운 1~2,000자(글), 1~500자(댓글). 글자 수는 코드 포인트로 센다. */
public final class CommunityText {
    public static final int MAX_POST = 2000;
    public static final int MAX_COMMENT = 500;

    private CommunityText() {}

    public static String postBody(Object raw) {
        return body(raw, MAX_POST, "글은 1~2,000자로 써 주세요.");
    }

    public static String commentBody(Object raw) {
        return body(raw, MAX_COMMENT, "댓글은 1~500자로 써 주세요.");
    }

    private static String body(Object raw, int max, String reason) {
        if (!(raw instanceof String value)) throw ApiException.invalidInput("body", reason);
        String body = value.strip();
        int length = body.codePointCount(0, body.length());
        if (length < 1 || length > max) throw ApiException.invalidInput("body", reason);
        return body;
    }
}
