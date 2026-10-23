package com.dartinsight.analysis.domain;

import java.util.List;

/** 문장 비교 결과. 실패해도 분석은 재무 결과로 완료하고, 이 상태와 메시지를 화면에 보여 준다. */
public record TextComparison(TextStatus status, String message, List<TextChangeRow> rows) {

    public static TextComparison failed(String message) {
        return new TextComparison(TextStatus.FAILED, message, List.of());
    }
}
