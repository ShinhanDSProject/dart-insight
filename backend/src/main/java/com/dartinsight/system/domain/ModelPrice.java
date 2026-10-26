package com.dartinsight.system.domain;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * 모델 하나의 가격(100만 토큰당 USD). 값은 설정(app.ai-usage.prices)에서만 오고 코드에 추측해 넣지 않는다(FS-50).
 *
 * @param inputPerMillionUsd 입력 100만 토큰당 USD
 * @param outputPerMillionUsd 출력 100만 토큰당 USD
 */
public record ModelPrice(BigDecimal inputPerMillionUsd, BigDecimal outputPerMillionUsd) {

    private static final BigDecimal MILLION = BigDecimal.valueOf(1_000_000);

    public ModelPrice {
        Objects.requireNonNull(inputPerMillionUsd, "inputPerMillionUsd");
        Objects.requireNonNull(outputPerMillionUsd, "outputPerMillionUsd");
    }

    /**
     * (입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가) ÷ 1,000,000. 반올림하지 않는다(합친 뒤 응답에서 반올림).
     * 모르는 토큰(null)은 0으로 더한다.
     */
    public BigDecimal cost(Long inputTokens, Long outputTokens) {
        BigDecimal input = BigDecimal.valueOf(inputTokens == null ? 0 : inputTokens).multiply(inputPerMillionUsd);
        BigDecimal output = BigDecimal.valueOf(outputTokens == null ? 0 : outputTokens).multiply(outputPerMillionUsd);
        return input.add(output).divide(MILLION);
    }
}
