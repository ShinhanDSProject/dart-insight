package com.dartinsight.summary;

import com.dartinsight.analysis.FinancialChangeRow;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/**
 * 재무 수치 변화의 사실 문장(3.2). 숫자는 코드가 계산한 값을 그대로 쓰고 LLM이 만들지 않는다.
 * 증감은 '늘었어요·줄었어요'로만 쓰고 좋고 나쁨을 평가하지 않는다.
 */
public final class FinancialFacts {

    private static final BigDecimal JO = new BigDecimal("1000000000000");
    private static final BigDecimal EOK = new BigDecimal("100000000");

    private FinancialFacts() {
    }

    /** 예: 매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%). */
    public static String sentence(FinancialChangeRow row) {
        String previous = amount(row.previousAmount(), row.currency());
        String current = amount(row.currentAmount(), row.currency());
        String verb = row.changeAmount() > 0 ? "늘었어요" : "줄었어요";
        String rate = row.changeRate() == null ? "" : "(" + rate(row.changeRate()) + ")";
        return row.accountName() + subject(row.accountName()) + " " + previous + "에서 " + current + toward(current)
                + " " + verb + rate + ".";
    }

    static String amount(long value, String currency) {
        String sign = value < 0 ? "−" : "";
        BigDecimal abs = BigDecimal.valueOf(value).abs();
        if (currency != null && !"KRW".equals(currency)) {
            return sign + grouped(abs.setScale(0, RoundingMode.HALF_UP)) + " " + currency;
        }
        if (abs.compareTo(JO) >= 0) {
            return sign + oneDecimal(abs.divide(JO, 1, RoundingMode.HALF_UP)) + "조 원";
        }
        if (abs.compareTo(EOK) >= 0) {
            return sign + grouped(abs.divide(EOK, 0, RoundingMode.HALF_UP)) + "억 원";
        }
        return sign + grouped(abs) + " 원";
    }

    static String rate(BigDecimal rate) {
        BigDecimal percent = rate.movePointRight(2).setScale(1, RoundingMode.HALF_UP);
        String sign = percent.signum() > 0 ? "+" : percent.signum() < 0 ? "−" : "";
        return sign + oneDecimal(percent.abs()) + "%";
    }

    private static String oneDecimal(BigDecimal value) {
        DecimalFormat format = new DecimalFormat("#,##0.#", DecimalFormatSymbols.getInstance(Locale.ROOT));
        return format.format(value);
    }

    private static String grouped(BigDecimal value) {
        DecimalFormat format = new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(Locale.ROOT));
        return format.format(value);
    }

    /** 주격 조사(이/가) */
    static String subject(String word) {
        Boolean batchim = batchim(word);
        return batchim == null ? "(이)가" : batchim ? "이" : "가";
    }

    /** 방향 조사(으로/로). 받침이 ㄹ이면 '로' */
    static String toward(String word) {
        char last = word.isEmpty() ? ' ' : word.charAt(word.length() - 1);
        if (last >= '가' && last <= '힣') {
            int jong = (last - '가') % 28;
            return jong == 0 || jong == 8 ? "로" : "으로";
        }
        if (Character.isDigit(last)) {
            // 영·삼·육은 받침이 있고(으로), 일·칠·팔은 받침이 ㄹ이며, 나머지는 받침이 없다(로)
            return "036".indexOf(last) >= 0 ? "으로" : "로";
        }
        return "(으)로";
    }

    private static Boolean batchim(String word) {
        char last = word.isEmpty() ? ' ' : word.charAt(word.length() - 1);
        if (last >= '가' && last <= '힣') {
            return (last - '가') % 28 != 0;
        }
        return null;
    }
}
