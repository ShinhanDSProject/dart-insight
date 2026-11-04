package com.dartinsight.system.domain;

import com.dartinsight.common.error.ApiException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 집계 기간. 한국 시간 날짜로 오늘(to)부터 거꾸로 days일이다: [from 00:00, to 다음 날 00:00).
 * AI 사용 현황(GET /api/system/ai-usage)과 관리자 개요(GET /api/admin/overview)가 같은 규칙을 쓴다.
 */
public record UsagePeriod(int days, LocalDate from, LocalDate to) {

    /** 두 화면이 고를 수 있는 기간 */
    public static final Set<Integer> ALLOWED_DAYS = Set.of(7, 30);

    /** days가 7·30이 아니면 400 errors[days] */
    public static UsagePeriod endingOn(LocalDate today, int days) {
        if (!ALLOWED_DAYS.contains(days)) {
            throw ApiException.invalidInput("days", "7 또는 30이어야 합니다.");
        }
        return new UsagePeriod(days, today.minusDays(days - 1L), today);
    }

    public LocalDateTime start() {
        return from.atStartOfDay();
    }

    /** 기간 끝(포함하지 않음) */
    public LocalDateTime end() {
        return to.plusDays(1).atStartOfDay();
    }

    /** 기간의 모든 날짜(오래된 순) */
    public List<LocalDate> dates() {
        return from.datesUntil(to.plusDays(1)).toList();
    }

    /** 기간의 모든 날짜(오래된 순) → 그날의 시각 수. 기록이 없는 날은 0, 기간 밖 시각은 세지 않는다 */
    public Map<LocalDate, Long> dailyCounts(Collection<LocalDateTime> times) {
        Map<LocalDate, Long> counted = times.stream()
                .collect(Collectors.groupingBy(LocalDateTime::toLocalDate, Collectors.counting()));
        Map<LocalDate, Long> daily = new LinkedHashMap<>();
        dates().forEach(date -> daily.put(date, counted.getOrDefault(date, 0L)));
        return daily;
    }
}
