package com.dartinsight.activity.domain;

import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * 요약에 넣을 재무 수치 문장(ADR-0068). LLM에 계산을 맡기지 않으려고 표시 단위와 증감률을 코드가 만든다.
 * 요약은 이 문장에 있는 숫자만 쓸 수 있다.
 */
public final class FinancialFactText {

    private static final String KRW = "KRW";
    private static final long TRILLION = 1_000_000_000_000L;
    private static final long HUNDRED_MILLION = 100_000_000L;
    private static final Map<String, String> STATEMENTS = Map.of("IS", "손익계산서", "CIS", "포괄손익계산서", "BS", "재무상태표",
            "CF", "현금흐름표", "SCE", "자본변동표");

    private FinancialFactText() {
    }

    /** 근거 위치 이름. 예: 연결 손익계산서 &gt; 매출액 */
    public static String label(FinancialChange change) {
        String division = change.getFsDiv() == FsDiv.CFS ? "연결" : "별도";
        String statement = STATEMENTS.getOrDefault(change.getSjDiv(), change.getSjDiv());
        return division + " " + statement + " > " + change.getAccountName();
    }

    /** 예: 연결 손익계산서 매출액: 이전 153.7조원, 이번 305.4조원, 증감액 +151.7조원, 증감률 +98.7% */
    public static String text(FinancialChange change) {
        String currency = change.getCurrency();
        String text = label(change).replace(" > ", " ") + ": 이전 " + money(change.getPreviousAmount(), currency)
                + ", 이번 " + money(change.getCurrentAmount(), currency)
                + ", 증감액 " + sign(change.getChangeAmount()) + money(Math.abs(change.getChangeAmount()), currency);
        BigDecimal rate = change.getChangeRate();
        return rate == null ? text : text + ", 증감률 " + percent(rate);
    }

    private static String money(long amount, String currency) {
        if (!KRW.equals(currency)) {
            return "%,d".formatted(amount) + (currency == null ? "" : " " + currency);
        }
        long abs = Math.abs(amount);
        String sign = amount < 0 ? "-" : "";
        if (abs >= TRILLION) {
            return sign + divide(abs, TRILLION, 1).toPlainString() + "조원";
        }
        if (abs >= HUNDRED_MILLION) {
            return sign + "%,d억원".formatted(divide(abs, HUNDRED_MILLION, 0).longValue());
        }
        return sign + "%,d원".formatted(abs);
    }

    private static BigDecimal divide(long amount, long unit, int scale) {
        return BigDecimal.valueOf(amount).divide(BigDecimal.valueOf(unit), scale, RoundingMode.HALF_UP);
    }

    private static String sign(long amount) {
        return amount < 0 ? "-" : "+";
    }

    private static String percent(BigDecimal rate) {
        BigDecimal value = rate.movePointRight(2).setScale(1, RoundingMode.HALF_UP);
        return (value.signum() < 0 ? "" : "+") + value.toPlainString() + "%";
    }
}
