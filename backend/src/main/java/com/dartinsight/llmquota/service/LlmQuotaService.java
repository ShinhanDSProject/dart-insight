package com.dartinsight.llmquota.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.llmquota.config.LlmQuotaProperties;
import com.dartinsight.llmquota.domain.DailyQuotaCounter;
import com.dartinsight.llmquota.domain.QuotaCaller;
import com.dartinsight.llmquota.domain.QuotaDecision;
import com.dartinsight.llmquota.domain.QuotaKind;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.EnumMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * LLM을 새로 부르기 전에 하루 한도를 확인한다. 질문·에이전트 채팅(ADR-0054), 사용자가 요청한 새 분석(ADR-0056),
 * 문장 변경 한 줄 풀이(ADR-0069)를 따로 센다.
 * 회원은 회원 ID, 아니면 클라이언트 IP로 센다.
 */
@Service
@RequiredArgsConstructor
public class LlmQuotaService {

    private static final Logger log = LoggerFactory.getLogger(LlmQuotaService.class);

    private final LlmQuotaProperties properties;
    private final Clock clock;
    private final Map<QuotaKind, DailyQuotaCounter> counters = new EnumMap<>(Map.of(
            QuotaKind.QUESTION, new DailyQuotaCounter(),
            QuotaKind.ANALYSIS, new DailyQuotaCounter(),
            QuotaKind.EXPLANATION, new DailyQuotaCounter()));

    /** 오늘 한 번 더 쓸 수 있으면 세고, 아니면 429 AI_QUOTA_EXCEEDED(Retry-After: 다음 날 0시까지 남은 초) */
    public void acquire(QuotaKind kind, QuotaCaller caller) {
        if (!properties.enabled()) {
            return;
        }
        LlmQuotaProperties.Limits limits = properties.limits(kind);
        int callerLimit = limits.caller(caller.member());
        DailyQuotaCounter counter = counters.get(kind);
        QuotaDecision decision = counter.acquire(caller.key(), callerLimit, limits.total(), LocalDate.now(clock));
        if (decision.allowed()) {
            return;
        }
        if (decision == QuotaDecision.TOTAL_EXCEEDED && counter.firstTotalExceededToday()) {
            // 운영자가 비용 상한 도달을 알 수 있게 하루 한 번 남긴다(ADR-0056, LOG-1의 예외)
            log.warn("오늘 {} 전체 한도({}회)에 닿아 다음 날 0시까지 새 요청을 막습니다", kind.label(), limits.total());
        }
        throw ApiException.retryAfter(ErrorCode.AI_QUOTA_EXCEEDED,
                message(kind, decision, caller.member(), callerLimit), secondsUntilReset());
    }

    /** 다음 날 0시(Clock의 시간대, 한국 시간)까지 남은 초 */
    long secondsUntilReset() {
        ZonedDateTime now = ZonedDateTime.now(clock);
        ZonedDateTime midnight = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone());
        return Math.max(1, Duration.between(now, midnight).toSeconds());
    }

    private static String message(QuotaKind kind, QuotaDecision decision, boolean member, int callerLimit) {
        String what = kind.label();
        if (decision == QuotaDecision.TOTAL_EXCEEDED) {
            return "오늘 서비스 전체 " + what + " 한도에 닿았어요. 내일 0시에 다시 쓸 수 있어요.";
        }
        if (member) {
            return "오늘 " + what + " " + callerLimit + "회를 다 썼어요. 내일 0시에 다시 쓸 수 있어요.";
        }
        return "로그인하지 않고 쓸 수 있는 오늘 " + what + " " + callerLimit + "회를 다 썼어요. 로그인하면 더 쓸 수 있어요.";
    }
}
