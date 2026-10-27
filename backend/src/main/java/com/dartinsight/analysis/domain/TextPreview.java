package com.dartinsight.analysis.domain;

/**
 * 목록에 보여 줄 앞부분. 수정이면 두 글이 처음 달라지는 곳 조금 앞부터 잘라, 바뀐 곳이 미리보기에 보이게 한다.
 */
public final class TextPreview {

    static final int LENGTH = 240;
    private static final int LEAD = 40;

    private TextPreview() {
    }

    /** 두 글이 처음 달라지는 위치. 하나가 null이면 0 */
    public static int firstDifference(String a, String b) {
        if (a == null || b == null) {
            return 0;
        }
        int n = Math.min(a.length(), b.length());
        int i = 0;
        while (i < n && a.charAt(i) == b.charAt(i)) {
            i++;
        }
        return i;
    }

    public static String cut(String text, int from) {
        if (text == null) {
            return null;
        }
        int start = Math.max(0, Math.min(from - LEAD, text.length() - LENGTH));
        // 낱말 중간에서 자르지 않도록 앞쪽 공백까지 물린다
        if (start > 0) {
            int space = text.lastIndexOf(' ', start);
            start = space > start - 20 && space >= 0 ? space + 1 : start;
        }
        int end = Math.min(text.length(), start + LENGTH);
        return (start > 0 ? "…" : "") + text.substring(start, end) + (end < text.length() ? "…" : "");
    }
}
