package com.dartinsight.aiserver.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * AI 서버(FastAPI) 연결 설정. application.yml의 app.ai-server.*
 *
 * @param internalToken FastAPI의 /internal/** 호출에 쓰는 공유 Bearer 토큰
 * @param readTimeout   분석 호출(원문 구조화·문장 비교·요약) 응답 대기 시간
 * @param healthTimeout 상태 확인(/internal/health) 응답 대기 시간. 상태 화면이 오래 멈추지 않도록 짧게 둔다
 * @param textEventsReadTimeout 주요 사건 만들기 응답 대기 시간. 묶기·금액 확인·사건 문장 단계를 더한 최악보다 길게 둔다(ADR-0060)
 */
@ConfigurationProperties(prefix = "app.ai-server")
public record AiServerProperties(
        @DefaultValue("http://localhost:8000") String baseUrl,
        String internalToken,
        @DefaultValue("2s") Duration connectTimeout,
        @DefaultValue("180s") Duration readTimeout,
        @DefaultValue("3s") Duration healthTimeout,
        @DefaultValue("1200s") Duration textEventsReadTimeout) {
}
