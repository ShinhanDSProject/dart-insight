package com.dartinsight.analysis.domain;

import com.dartinsight.common.error.ApiException;
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

    /**
     * 원문을 받거나 읽다가 실패해 문장을 비교하지 못함.
     * ApiException 메시지는 사용자에게 보여 줄 수 있는 사유라 덧붙이고, 그 밖의 예외 글(DB·파일 경로 등)은 화면에 내보내지 않는다.
     */
    public static TextComparison documentFailed(RuntimeException cause) {
        String reason = cause instanceof ApiException ? " (" + cause.getMessage() + ")" : "";
        return failed("원문을 받거나 읽지 못해 문장을 비교하지 못했어요. 다시 요청해 주세요." + reason);
    }
}
