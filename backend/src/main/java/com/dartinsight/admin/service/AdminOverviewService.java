package com.dartinsight.admin.service;

import com.dartinsight.admin.dto.AdminOverviewResponse;
import com.dartinsight.analysis.domain.AnalysisStats;
import com.dartinsight.analysis.service.AnalysisMonitorService;
import com.dartinsight.community.service.CommunityModerationService;
import com.dartinsight.community.service.CommunityPostService;
import com.dartinsight.favorite.service.FavoriteCompanyService;
import com.dartinsight.planinterest.service.PlanInterestService;
import com.dartinsight.system.domain.UsagePeriod;
import com.dartinsight.system.service.AiUsageService;
import com.dartinsight.user.service.UserDirectoryService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 개요(3.34, FS-72). 각 표는 그 도메인 Service를 거쳐 센다(PKG-3).
 * 기간은 AI 사용 현황과 같은 규칙(UsagePeriod)이다. 관리자인지는 SecurityConfig가 확인한다(ADR-0040).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AdminOverviewService {
    /** 상위 목록(실패 사유·분석 기업·관심 기업)의 개수 */
    static final int TOP = 5;

    private final AnalysisMonitorService analysisMonitorService;
    private final UserDirectoryService userDirectoryService;
    private final FavoriteCompanyService favoriteCompanyService;
    private final CommunityModerationService communityModerationService;
    private final CommunityPostService communityPostService;
    private final AiUsageService aiUsageService;
    private final PlanInterestService planInterestService;
    private final Clock clock;

    /** days가 7·30이 아니면 400 errors[days] */
    public AdminOverviewResponse overview(int days) {
        UsagePeriod period = UsagePeriod.endingOn(LocalDate.now(clock), days);
        LocalDateTime start = period.start();
        LocalDateTime end = period.end();
        AnalysisStats analyses = analysisMonitorService.stats(start, end, period.dates(), TOP);
        return AdminOverviewResponse.of(period, analyses, analysisMonitorService.corpNames(analyses.topCorpCodes()),
                userDirectoryService.stats(start, end), favoriteCompanyService.watchStats(TOP),
                communityModerationService.todoCount(), communityPostService.countWritten(start, end),
                aiUsageService.llmCallTotals(start, end), planInterestService.tally(start, end));
    }
}
