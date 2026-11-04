package com.dartinsight.admin.dto;

import com.dartinsight.analysis.domain.AnalysisStats;
import com.dartinsight.favorite.domain.WatchStats;
import com.dartinsight.planinterest.domain.PlanInterestTally;
import com.dartinsight.system.domain.LlmCallTotals;
import com.dartinsight.system.domain.UsagePeriod;
import com.dartinsight.user.domain.UserStats;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 관리자 개요(docs/api-spec.md GET /api/admin/overview, FS-72). 집계만 담고 이메일 등 개인정보는 담지 않는다.
 * 수·비율·백분위·비용은 각 도메인이 코드로 계산한 값이고, 분모가 없으면 null이다(0과 구분).
 */
public record AdminOverviewResponse(int days, LocalDate from, LocalDate to, Analyses analyses, Users users,
        Watch watch, Community community, Ai ai, PlanInterests planInterests) {

    /**
     * @param analysisCorpNames 분석 상위 기업의 고유번호 → 기업명
     */
    public static AdminOverviewResponse of(UsagePeriod period, AnalysisStats analyses,
            Map<String, String> analysisCorpNames, UserStats users, WatchStats watch, long openReports,
            long postsInPeriod, LlmCallTotals ai, PlanInterestTally planInterests) {
        return new AdminOverviewResponse(period.days(), period.from(), period.to(),
                Analyses.of(analyses, analysisCorpNames), Users.of(users, period), Watch.of(watch),
                new Community(openReports, postsInPeriod),
                new Ai(ai.calls(), ai.failedCalls(), ai.estimatedCostUsd(), ai.unpricedCalls()),
                PlanInterests.of(planInterests, period));
    }

    private static Map<String, Long> named(Map<? extends Enum<?>, Long> counts) {
        Map<String, Long> named = new LinkedHashMap<>();
        counts.forEach((key, value) -> named.put(key.name(), value));
        return named;
    }

    public record Analyses(long requested, long completed, long failed, long inProgress, Double completionRate,
            Long p50Seconds, Long p90Seconds, long outdated, List<AnalysisDaily> daily,
            List<FailureCount> topFailures, List<CompanyCount> topCompanies) {

        static Analyses of(AnalysisStats s, Map<String, String> corpNames) {
            return new Analyses(s.requested(), s.completed(), s.failed(), s.inProgress(), s.completionRate(),
                    s.p50Seconds(), s.p90Seconds(), s.outdated(),
                    s.daily().stream()
                            .map(d -> new AnalysisDaily(d.date(), d.requested(), d.completed(), d.failed()))
                            .toList(),
                    s.topFailures().stream()
                            .map(f -> new FailureCount(f.errorCode(), f.count(), f.lastAt()))
                            .toList(),
                    s.topCompanies().stream()
                            .map(c -> new CompanyCount(c.corpCode(), corpNames.get(c.corpCode()), c.count()))
                            .toList());
        }
    }

    public record AnalysisDaily(LocalDate date, long requested, long completed, long failed) {
    }

    public record FailureCount(String errorCode, long count,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime lastAt) {
    }

    /** @param corpName 기업 표에 없으면 null */
    public record CompanyCount(String corpCode, String corpName, long count) {
    }

    public record Users(long total, long newInPeriod, long admins, Map<String, Long> byProvider,
            List<SignupDaily> daily) {

        static Users of(UserStats s, UsagePeriod period) {
            Map<LocalDate, Long> daily = period.dailyCounts(s.signedUpAts());
            return new Users(s.total(), daily.values().stream().mapToLong(Long::longValue).sum(), s.admins(),
                    named(s.byProvider()),
                    daily.entrySet().stream().map(e -> new SignupDaily(e.getKey(), e.getValue())).toList());
        }
    }

    public record SignupDaily(LocalDate date, long signups) {
    }

    public record Watch(long favorites, long companies, List<CompanyCount> topWatched) {

        static Watch of(WatchStats s) {
            return new Watch(s.favorites(), s.companies(), s.topWatched().stream()
                    .map(w -> new CompanyCount(w.corpCode(), w.corpName(), w.count()))
                    .toList());
        }
    }

    /** @param openReports 관리자 신고 목록 '처리할 것'(queue=todo)의 수 */
    public record Community(long openReports, long postsInPeriod) {
    }

    /** @param estimatedCostUsd 가격이 설정된 호출이 없으면 null */
    public record Ai(long calls, long failedCalls, Double estimatedCostUsd, long unpricedCalls) {
    }

    public record PlanInterests(long total, long signedIn, Map<String, Long> byPlan, List<CountDaily> daily) {

        static PlanInterests of(PlanInterestTally t, UsagePeriod period) {
            return new PlanInterests(t.total(), t.signedIn(), named(t.byPlan()),
                    period.dailyCounts(t.createdAts()).entrySet().stream()
                            .map(e -> new CountDaily(e.getKey(), e.getValue()))
                            .toList());
        }
    }

    public record CountDaily(LocalDate date, long count) {
    }
}
