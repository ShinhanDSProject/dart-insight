package com.dartinsight.analysis.domain;

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
    /** 이익 계정이 음수에서 양수로(흑자전환). 증감률은 계산하지 않음(증감액은 계산) */
    TURNED_PROFIT("흑자로 돌아서 증감률을 계산하지 않아요."),
    /** 이익 계정이 양수에서 음수로(적자전환) */
    TURNED_LOSS("적자로 돌아서 증감률을 계산하지 않아요."),
    /** 이익 계정이 음수에서 0이나 더 작은 손실로(적자폭 축소) */
    LOSS_NARROWED("적자폭이 줄었어요. 이전 값이 음수라 증감률을 계산하지 않아요."),
    /** 이익 계정이 음수에서 더 큰 손실로(적자폭 확대) */
    LOSS_WIDENED("적자폭이 커졌어요. 이전 값이 음수라 증감률을 계산하지 않아요."),
    /** 이익 계정이 아닌 계정의 부호가 바뀜 */
    SIGN_CHANGED("부호가 바뀌어 증감률을 계산하지 않아요."),
    /** 이전 보고서에 계정은 있지만 값이 없음 */
    PREVIOUS_MISSING("이전 보고서에 값이 없어 계산하지 않아요."),
    /** 현재 보고서에 계정은 있지만 값이 없음 */
    CURRENT_MISSING("현재 보고서에 값이 없어 계산하지 않아요."),
    /** 현재 보고서에만 있는 계정 */
    ONLY_CURRENT("이전 보고서에 없는 계정이라 계산하지 않아요."),
    /** 이전 보고서에만 있는 계정 */
    ONLY_PREVIOUS("현재 보고서에 없는 계정이라 계산하지 않아요."),
    /** 같은 계정이 여러 개이고 두 보고서의 개수가 달라 짝을 확정하지 못함(검토 필요) */
    AMBIGUOUS_MATCH("같은 계정이 여러 개라 두 보고서의 짝을 확정하지 못해 계산하지 않아요."),
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

    /** 이익 계정의 흑자·적자 상태(흑자전환·적자전환·적자폭 축소·확대)인지 */
    public boolean profitState() {
        return this == TURNED_PROFIT || this == TURNED_LOSS || this == LOSS_NARROWED || this == LOSS_WIDENED;
    }
}
