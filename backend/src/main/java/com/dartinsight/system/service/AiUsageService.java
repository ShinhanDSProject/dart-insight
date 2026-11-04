package com.dartinsight.system.service;

import com.dartinsight.explanation.service.ExplanationService;
import com.dartinsight.question.service.QuestionService;
import com.dartinsight.summary.service.SummaryQueryService;
import com.dartinsight.system.config.AiUsageProperties;
import com.dartinsight.system.domain.LlmCallTotals;
import com.dartinsight.system.domain.UsagePeriod;
import com.dartinsight.system.dto.AiUsageResponse;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AI 사용 현황(FS-15, 0.7). 질문·풀이·LLM 호출 표는 각 도메인 Service를 거쳐 센다(PKG-3).
 * 기간은 한국 시간 날짜로 오늘부터 거꾸로 days일이다: [오늘 − (days − 1)일 00:00, 내일 00:00)(UsagePeriod).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AiUsageService {

    private final QuestionService questionService;
    private final ExplanationService explanationService;
    private final SummaryQueryService summaryQueryService;
    private final AiUsageProperties aiUsageProperties;
    private final Clock clock;

    /** days가 7·30이 아니면 400 errors[days] */
    public AiUsageResponse usage(int days) {
        UsagePeriod period = UsagePeriod.endingOn(LocalDate.now(clock), days);
        LocalDateTime start = period.start();
        LocalDateTime end = period.end();
        return AiUsageResponse.of(days, period.from(), period.to(), questionService.usage(start, end),
                explanationService.usage(start, end), summaryQueryService.llmCallUsage(start, end), aiUsageProperties);
    }

    /** [from, to)의 LLM 호출 수·실패 수·추정 비용(관리자 개요). 비용은 usage와 같은 모델 가격으로 계산한다 */
    public LlmCallTotals llmCallTotals(LocalDateTime from, LocalDateTime to) {
        return LlmCallTotals.of(summaryQueryService.llmCallUsage(from, to), aiUsageProperties::price);
    }
}
