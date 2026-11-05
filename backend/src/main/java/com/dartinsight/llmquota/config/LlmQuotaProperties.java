package com.dartinsight.llmquota.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 질문·에이전트 채팅의 하루 LLM 호출 한도(ADR-0054). 하루는 한국 시간 0시에 바뀐다.
 *
 * @param anonymousPerDay 로그인하지 않은 클라이언트 IP 하나의 하루 횟수
 * @param memberPerDay 회원 한 명의 하루 횟수
 * @param totalPerDay 서비스 전체 하루 횟수(비용 상한)
 */
@ConfigurationProperties(prefix = "app.llm-quota")
public record LlmQuotaProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("20") int anonymousPerDay,
        @DefaultValue("100") int memberPerDay,
        @DefaultValue("3000") int totalPerDay) {
}
