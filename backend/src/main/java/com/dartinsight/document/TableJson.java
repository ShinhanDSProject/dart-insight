package com.dartinsight.document;

import com.dartinsight.document.StructuredDocumentResponse.Cell;
import java.util.List;

/**
 * 표 셀을 JSON 문자열로 저장한다. 응답에서는 그대로 내보낸다({@code @JsonRawValue}).
 * 모양: {@code [[{"text":"구분","header":true,"colspan":2}, ...], ...]}
 */
public final class TableJson {

    private TableJson() {
    }

    public static String write(List<List<Cell>> rows) {
        if (rows == null) {
            return null;
        }
        StringBuilder out = new StringBuilder("[");
        for (int r = 0; r < rows.size(); r++) {
            out.append(r == 0 ? "[" : ",[");
            List<Cell> row = rows.get(r) == null ? List.of() : rows.get(r);
            for (int c = 0; c < row.size(); c++) {
                Cell cell = row.get(c);
                out.append(c == 0 ? "{" : ",{").append("\"text\":").append(quote(cell.text()));
                if (Boolean.TRUE.equals(cell.header())) {
                    out.append(",\"header\":true");
                }
                if (cell.colspan() != null && cell.colspan() > 1) {
                    out.append(",\"colspan\":").append(cell.colspan());
                }
                if (cell.rowspan() != null && cell.rowspan() > 1) {
                    out.append(",\"rowspan\":").append(cell.rowspan());
                }
                out.append('}');
            }
            out.append(']');
        }
        return out.append(']').toString();
    }

    static String quote(String text) {
        if (text == null) {
            return "\"\"";
        }
        StringBuilder out = new StringBuilder(text.length() + 2).append('"');
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            switch (ch) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (ch < 0x20 || ch == ' ' || ch == ' ') {
                        out.append(String.format("\\u%04x", (int) ch));
                    } else {
                        out.append(ch);
                    }
                }
            }
        }
        return out.append('"').toString();
    }
}
