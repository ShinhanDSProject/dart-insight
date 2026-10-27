package com.dartinsight.note.domain;

import com.dartinsight.analysis.domain.CalcStatus;
import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.financial.domain.StatementType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.util.regex.Pattern;

/**
 * 재무 수치 사본의 이름과 값 문장. 저장된 계산 결과(금액·증감액·증감률·계산 상태)를 코드로 옮긴 것이고 LLM을 쓰지 않는다.
 * 상태가 없다.
 */
public final class FinancialNoteText {
    private static final Pattern COMPONENT_TAG = Pattern.compile("\\s*\\[[^\\]]*\\]\\s*$");
    private static final String MINUS = "−";

    private FinancialNoteText() {
    }

    /** '손익계산서 · 매출액'. 자본변동표는 계정 상세의 마지막 구성요소를 더한다(#401, 화면 accountLabel과 같음) */
    public static String label(FinancialChange change) {
        String statement = StatementType.of(change.getSjDiv()).map(StatementType::label).orElse(change.getSjDiv());
        String label = statement + " · " + change.getAccountName();
        String component = componentName(change.getAccountDetail());
        return component == null ? label : label + " · " + component;
    }

    /** '이전 1,000원 → 현재 1,200원, 증감 +200원(+20.0%)'. 계산하지 않았으면 그 사유를 붙인다 */
    public static String text(FinancialChange change) {
        CalcStatus status = change.getCalcStatus();
        String unit = unit(change.getCurrency());
        StringBuilder text = new StringBuilder()
                .append("이전 ").append(amount(change.getPreviousAmount(), unit, status == CalcStatus.ONLY_CURRENT))
                .append(" → 현재 ").append(amount(change.getCurrentAmount(), unit, status == CalcStatus.ONLY_PREVIOUS));
        if (change.getChangeAmount() != null) {
            text.append(", 증감 ").append(signed(change.getChangeAmount())).append(unit);
            if (change.getChangeRate() != null) {
                text.append('(').append(rate(change.getChangeRate())).append(')');
            }
        }
        if (status != null && status.message() != null) {
            text.append(". ").append(status.message());
        }
        return text.toString();
    }

    private static String componentName(String detail) {
        if (detail == null) {
            return null;
        }
        String[] parts = detail.split("\\|");
        String last = COMPONENT_TAG.matcher(parts[parts.length - 1]).replaceAll("").strip();
        return last.isEmpty() ? null : last;
    }

    private static String unit(String currency) {
        return currency == null || "KRW".equals(currency) ? "원" : " " + currency;
    }

    private static String amount(Long value, String unit, boolean absent) {
        if (value == null) {
            return absent ? "없음" : "미기재";
        }
        return (value < 0 ? MINUS : "") + grouped(Math.abs(value)) + unit;
    }

    private static String signed(long value) {
        if (value == 0) {
            return "0";
        }
        return (value > 0 ? "+" : MINUS) + grouped(Math.abs(value));
    }

    /** 비율 0.153 → +15.3% */
    private static String rate(BigDecimal ratio) {
        BigDecimal percent = ratio.movePointRight(2).setScale(1, RoundingMode.HALF_UP);
        int sign = percent.signum();
        return (sign > 0 ? "+" : sign < 0 ? MINUS : "") + percent.abs().toPlainString() + "%";
    }

    private static String grouped(long value) {
        return new DecimalFormat("#,##0").format(value);
    }
}
