package com.dartinsight.llmquota.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.llmquota.config.LlmQuotaProperties;
import com.dartinsight.llmquota.domain.DailyQuotaCounter;
import com.dartinsight.llmquota.domain.QuotaDecision;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 질문·에이전트 채팅이 LLM을 부르기 전에 하루 한도를 확인한다(ADR-0054). 회원은 회원 ID, 아니면 클라이언트 IP로 센다.
 */
@Service
@RequiredArgsConstructor
public class LlmQuotaService {

    private final LlmQuotaProperties properties;
    private final Clock clock;
    private final DailyQuotaCounter counter = new DailyQuotaCounter();

    /** 오늘 한 번 더 쓸 수 있으면 세고, 아니면 429 AI_QUOTA_EXCEEDED */
    public void acquire(Long userId, String clientIp) {
        if (!properties.enabled()) {
            return;
        }
        boolean member = userId != null;
        String caller = member ? "user:" + userId : "ip:" + clientIp;
        int callerLimit = member ? properties.memberPerDay() : properties.anonymousPerDay();
        QuotaDecision decision = counter.acquire(caller, callerLimit, properties.totalPerDay(), LocalDate.now(clock));
        if (!decision.allowed()) {
            throw new ApiException(ErrorCode.AI_QUOTA_EXCEEDED, message(decision, member, callerLimit));
        }
    }

    /** 다음 날 0시(Clock의 시간대, 한국 시간)까지 남은 초. Retry-After에 쓴다 */
    public long secondsUntilReset() {
        ZonedDateTime now = ZonedDateTime.now(clock);
        ZonedDateTime midnight = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone());
        return Math.max(1, Duration.between(now, midnight).toSeconds());
    }

    private static String message(QuotaDecision decision, boolean member, int callerLimit) {
        if (decision == QuotaDecision.TOTAL_EXCEEDED) {
            return "오늘 서비스 전체 AI 질문 한도에 닿았어요. 내일 0시에 다시 쓸 수 있어요.";
        }
        if (member) {
            return "오늘 AI 질문 " + callerLimit + "회를 다 썼어요. 내일 0시에 다시 쓸 수 있어요.";
        }
        return "로그인하지 않고 쓸 수 있는 오늘 AI 질문 " + callerLimit + "회를 다 썼어요. 로그인하면 더 쓸 수 있어요.";
    }
}
