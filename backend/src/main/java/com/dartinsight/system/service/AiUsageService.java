package com.dartinsight.system.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.explanation.service.ExplanationService;
import com.dartinsight.question.service.QuestionService;
import com.dartinsight.summary.service.SummaryQueryService;
import com.dartinsight.system.dto.AiUsageResponse;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AI 사용 현황(FS-15, 0.7). 질문·풀이·LLM 호출 표는 각 도메인 Service를 거쳐 센다(PKG-3).
 * 기간은 한국 시간 날짜로 오늘부터 거꾸로 days일이다: [오늘 − (days − 1)일 00:00, 내일 00:00).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AiUsageService {

    static final Set<Integer> ALLOWED_DAYS = Set.of(7, 30);

    private final QuestionService questionService;
    private final ExplanationService explanationService;
    private final SummaryQueryService summaryQueryService;
    private final Clock clock;

    /** days가 7·30이 아니면 400 errors[days] */
    public AiUsageResponse usage(int days) {
        if (!ALLOWED_DAYS.contains(days)) {
            throw ApiException.invalidInput("days", "7 또는 30이어야 합니다.");
        }
        LocalDate to = LocalDate.now(clock);
        LocalDate from = to.minusDays(days - 1L);
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();
        return AiUsageResponse.of(days, from, to, questionService.usage(start, end),
                explanationService.usage(start, end), summaryQueryService.llmCallUsage(start, end));
    }
}
