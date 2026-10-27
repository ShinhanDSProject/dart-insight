package com.dartinsight.summary.service;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 재무 수치 변화의 사실 문장(3.2). 숫자는 코드가 계산한 값을 그대로 쓰고 LLM이 만들지 않는다.
 * 증감은 '늘었어요·줄었어요'로만 쓰고 좋고 나쁨을 평가하지 않는다.
 */
public final class FinancialFacts {

    private static final BigDecimal JO = new BigDecimal("1000000000000");
    private static final BigDecimal EOK = new BigDecimal("100000000");
    /** 계정명 끝의 괄호 부분('(손실)', '(수익)'). 조사는 괄호 앞 낱말에 맞춘다 */
    private static final Pattern TRAILING_PARENTHESES = Pattern.compile("(\\s*\\([^()]*\\))+$");

    private FinancialFacts() {
    }

    /**
     * 예: 매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%).
     * 이익 계정의 흑자·적자 상태면 증감률 없이 상태를 쓴다(#144). 예: 영업이익이 −7.7조 원에서 23.5조 원으로 바뀌어 흑자로 돌아섰어요.
     */
    public static String sentence(FinancialChangeRow row) {
        String previous = amount(row.previousAmount(), row.currency());
        String current = amount(row.currentAmount(), row.currency());
        String state = profitState(row.calcStatus());
        if (state != null) {
            return row.accountName() + subject(row.accountName()) + " " + previous + "에서 " + current
                    + toward(current) + " 바뀌어 " + state + ".";
        }
        String verb = row.changeAmount() > 0 ? "늘었어요" : "줄었어요";
        String rate = row.changeRate() == null ? "" : "(" + rate(row.changeAmount(), row.previousAmount()) + ")";
        return row.accountName() + subject(row.accountName()) + " " + previous + "에서 " + current + toward(current)
                + " " + verb + rate + ".";
    }

    /** 이익 계정의 흑자·적자 상태 문구. 그 밖의 상태면 null */
    private static String profitState(CalcStatus status) {
        if (status == null) {
            return null;
        }
        return switch (status) {
            case TURNED_PROFIT -> "흑자로 돌아섰어요";
            case TURNED_LOSS -> "적자로 돌아섰어요";
            case LOSS_NARROWED -> "적자폭이 줄었어요";
            case LOSS_WIDENED -> "적자폭이 커졌어요";
            default -> null;
        };
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

    /**
     * 증감률(%, 소수 1자리). 저장된 증감률(소수 6자리)을 다시 반올림하면 한 번 더 반올림돼 어긋날 수 있어
     * 두 금액으로 바로 계산한다(근거 패널의 계산식과 같은 방식).
     */
    static String rate(long change, long previous) {
        BigDecimal percent = BigDecimal.valueOf(change).movePointRight(2)
                .divide(BigDecimal.valueOf(previous), 1, RoundingMode.HALF_UP);
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

    /** 주격 조사(이/가). 끝의 괄호 부분은 빼고 본다: 영업이익(손실) → 영업이익(손실)이 */
    static String subject(String word) {
        Boolean batchim = batchim(TRAILING_PARENTHESES.matcher(word).replaceFirst(""));
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
