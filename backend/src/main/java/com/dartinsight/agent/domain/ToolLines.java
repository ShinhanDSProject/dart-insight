package com.dartinsight.agent.domain;

import java.util.ArrayList;
import java.util.List;

/**
 * Tool 결과를 정해진 크기로 줄인다(docs/api-spec.md 3절: 한 결과 10개·4,000자). 줄을 넘기거나 글을 자르면
 * truncated다. 자른 줄의 근거는 그대로 둔다(근거 ID는 위치라 글을 잘라도 같다).
 */
public final class ToolLines {

    private static final String ELLIPSIS = "…";

    private ToolLines() {
    }

    public record Limited(List<ToolLine> lines, boolean truncated) {
    }

    public static Limited limit(List<ToolLine> lines, int maxItems, int maxChars) {
        List<ToolLine> kept = new ArrayList<>();
        int used = 0;
        boolean truncated = lines.size() > maxItems;
        for (ToolLine line : lines.subList(0, Math.min(lines.size(), maxItems))) {
            int left = maxChars - used;
            if (left <= 0) {
                truncated = true;
                break;
            }
            String text = line.text() == null ? "" : line.text();
            if (text.length() > left) {
                text = text.substring(0, left) + ELLIPSIS;
                truncated = true;
            }
            kept.add(line.withText(text));
            used += text.length();
        }
        return new Limited(List.copyOf(kept), truncated);
    }
}
