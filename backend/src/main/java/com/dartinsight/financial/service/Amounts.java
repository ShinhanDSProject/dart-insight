package com.dartinsight.financial.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * OpenDART 금액 문자열을 원 단위 정수로 바꾼다. 빈 값과 '-'는 null(없는 값)이고 0과 구분한다.
 */
final class Amounts {

    private Amounts() {
    }

    static Long parse(String text) {
        if (text == null) {
            return null;
        }
        String value = text.replace(",", "").replace(" ", "").trim();
        if (value.isEmpty() || "-".equals(value)) {
            return null;
        }
        try {
            return new BigDecimal(value).setScale(0, RoundingMode.UNNECESSARY).longValueExact();
        } catch (NumberFormatException | ArithmeticException e) {
            return null;
        }
    }

    static Integer parseInt(String text) {
        Long value = parse(text);
        return value == null || value > Integer.MAX_VALUE || value < Integer.MIN_VALUE ? null : value.intValue();
    }
}
