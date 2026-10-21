package com.dartinsight.analysis;

/**
 * 계정별 계산 상태(docs/erd.md financial_change.calc_status). 없는 값을 0으로 보지 않는다.
 */
public enum CalcStatus {
    /** 증감액과 증감률을 계산함 */
    OK("계산함"),
    /** 이전 값이 0이라 증감률을 계산하지 않음(증감액은 계산) */
    PREVIOUS_ZERO("이전 값이 0이라 증감률을 계산하지 않아요."),
    /** 이전 값이 음수라 증감률을 계산하지 않음(증감액은 계산) */
    PREVIOUS_NEGATIVE("이전 값이 음수라 증감률을 계산하지 않아요."),
    /** 이전 보고서에 계정은 있지만 값이 없음 */
    PREVIOUS_MISSING("이전 보고서에 값이 없어 계산하지 않아요."),
    /** 현재 보고서에 계정은 있지만 값이 없음 */
    CURRENT_MISSING("현재 보고서에 값이 없어 계산하지 않아요."),
    /** 현재 보고서에만 있는 계정 */
    ONLY_CURRENT("이전 보고서에 없는 계정이라 계산하지 않아요."),
    /** 이전 보고서에만 있는 계정 */
    ONLY_PREVIOUS("현재 보고서에 없는 계정이라 계산하지 않아요."),
    /** 두 보고서의 기간 기준이 달라 비교하지 않는 재무제표 */
    PERIOD_MISMATCH("두 보고서의 기간 기준이 달라 비교하지 않아요.");

    private final String message;

    CalcStatus(String message) {
        this.message = message;
    }

    /** 화면에 보여 줄 사유. OK면 null */
    public String message() {
        return this == OK ? null : message;
    }
}
