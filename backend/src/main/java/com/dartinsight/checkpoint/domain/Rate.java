package com.dartinsight.checkpoint.domain;

import com.dartinsight.checkpoint.domain.CheckpointFact.Reason;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 코드가 계산한 백분율(%)이나 백분율 차이(%p). 소수 첫째 자리에서 반올림(HALF_UP)한다. 계산하지 못했으면 value가 null이고
 * reason이 그 이유다.
 */
public record Rate(BigDecimal value, Reason reason) {

    static final int SCALE = 1;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public static Rate missing() {
        return new Rate(null, Reason.MISSING);
    }

    public boolean present() {
        return value != null;
    }

    /** 증가율 = (올해 − 작년) ÷ 작년 × 100. 작년 값이 0이면 PREVIOUS_ZERO, 음수면 PREVIOUS_NEGATIVE */
    public static Rate growth(Long previous, Long current) {
        if (previous == null || current == null) {
            return missing();
        }
        if (previous == 0) {
            return new Rate(null, Reason.PREVIOUS_ZERO);
        }
        if (previous < 0) {
            return new Rate(null, Reason.PREVIOUS_NEGATIVE);
        }
        BigDecimal change = BigDecimal.valueOf(current).subtract(BigDecimal.valueOf(previous));
        return new Rate(change.multiply(HUNDRED).divide(BigDecimal.valueOf(previous), SCALE, RoundingMode.HALF_UP), null);
    }

    /** 비율 = 분자 ÷ 분모 × 100. 분모가 0 이하이면 EQUITY_NOT_POSITIVE(부채비율에만 쓴다) */
    public static Rate ratio(Long numerator, Long denominator) {
        if (numerator == null || denominator == null) {
            return missing();
        }
        if (denominator <= 0) {
            return new Rate(null, Reason.EQUITY_NOT_POSITIVE);
        }
        return new Rate(BigDecimal.valueOf(numerator).multiply(HUNDRED)
                .divide(BigDecimal.valueOf(denominator), SCALE, RoundingMode.HALF_UP), null);
    }

    /** 이 값 − 다른 값(%p). 반올림한 두 값끼리 뺀다(화면에 보이는 수와 같게). 하나라도 없으면 그 이유를 잇는다 */
    public Rate minus(Rate other) {
        if (!present()) {
            return this;
        }
        if (!other.present()) {
            return other;
        }
        return new Rate(value.subtract(other.value), null);
    }

    /** 기준값 이상인지. 값이 없으면 false */
    public boolean atLeast(int threshold) {
        return present() && value.compareTo(BigDecimal.valueOf(threshold)) >= 0;
    }
}
