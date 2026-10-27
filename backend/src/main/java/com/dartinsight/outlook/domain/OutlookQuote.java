package com.dartinsight.outlook.domain;

import java.util.regex.Pattern;

/** 인용 글 비교 규칙. ai-server app/outlook/validate.py normalize와 같다(ADR-0039). */
public final class OutlookQuote {

    private static final Pattern SPACES = Pattern.compile("\\s+");

    private OutlookQuote() {
    }

    /** 프롬프트에서 바꿔 넣은 &amp;lt; 등을 되돌리고 이어진 공백을 한 칸으로 */
    public static String normalize(String text) {
        if (text == null) {
            return "";
        }
        String plain = text.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&amp;", "&");
        return SPACES.matcher(plain).replaceAll(" ").strip();
    }
}
