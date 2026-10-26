package com.dartinsight.system.config;

import com.dartinsight.system.domain.ModelPrice;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI 사용 현황 설정. application.yml의 app.ai-usage.*
 *
 * @param prices "제공자:모델"(llm_call.provider·model) → 100만 토큰당 입력·출력 USD. 공식 가격 페이지 값만 넣고,
 *     없는 모델(가짜 제공자 fake 포함)은 추정 비용이 null이다(FS-50)
 */
@ConfigurationProperties(prefix = "app.ai-usage")
public record AiUsageProperties(Map<String, ModelPrice> prices) {

    public AiUsageProperties {
        prices = prices == null ? Map.of() : Map.copyOf(prices);
    }

    /** 그 제공자·모델의 가격. 설정이 없으면 비어 있다 */
    public Optional<ModelPrice> price(String provider, String model) {
        return Optional.ofNullable(prices.get(provider + ":" + model));
    }
}
