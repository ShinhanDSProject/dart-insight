package com.dartinsight.analysis.domain;

import java.util.List;

/**
 * 문장 비교 결과. 실패해도 분석은 재무 결과로 완료하고, 이 상태와 메시지를 화면에 보여 준다.
 *
 * @param missingFields 두 보고서 어느 쪽에도 그 분야의 섹션이 없는 분야(ADR-0047). 분류하지 않았으면 null
 */
public record TextComparison(TextStatus status, String message, List<TextChangeRow> rows,
        List<String> missingFields) {

    /** 분류하지 않은 결과 */
    public TextComparison(TextStatus status, String message, List<TextChangeRow> rows) {
        this(status, message, rows, null);
    }

    public static TextComparison failed(String message) {
        return new TextComparison(TextStatus.FAILED, message, List.of());
    }
}
