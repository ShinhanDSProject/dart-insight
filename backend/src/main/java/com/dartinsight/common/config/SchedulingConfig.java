package com.dartinsight.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** @Scheduled 작업(즐겨찾기 폴링, ADR-0027)을 켠다. */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
