package com.dartinsight.agent.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * AI 에이전트 채팅 설정(ADR-0044). application.yml의 app.agent.*
 *
 * @param maxSteps       채팅 한 번에 ai-server를 부르는 최대 횟수
 * @param timeout        채팅 한 번의 전체 시간. 왕복을 시작하기 전에만 확인하고 이미 시작한 호출은 끊지 않는다
 * @param maxItems       한 Tool 결과에 넣는 줄 수
 * @param maxResultChars 한 Tool 결과 글의 합(넘으면 줄여 보내고 truncated로 알림)
 */
@ConfigurationProperties(prefix = "app.agent")
public record AgentProperties(
        @DefaultValue("5") int maxSteps,
        @DefaultValue("60s") Duration timeout,
        @DefaultValue("10") int maxItems,
        @DefaultValue("4000") int maxResultChars) {
}
