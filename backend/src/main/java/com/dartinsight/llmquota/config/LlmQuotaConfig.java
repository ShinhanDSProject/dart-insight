package com.dartinsight.llmquota.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(LlmQuotaProperties.class)
public class LlmQuotaConfig {
}
