package com.dartinsight.analysis.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 한 기간에 요청한(created_at) 분석의 집계(관리자 개요, docs/api-spec.md GET /api/admin/overview).
 * 수·비율·백분위는 여기서 계산하고, 분모가 없으면 null이다(0과 구분).
 *
 * @param completed 지금 상태가 COMPLETED인 수
 * @param failed 지금 상태가 FAILED인 수
 * @param inProgress PENDING·RUNNING인 수
 * @param completionRate completed ÷ (completed + failed), 소수 넷째 자리 반올림. 분모가 0이면 null
 * @param p50Seconds 완료한 분석의 걸린 시간 중앙값(가장 가까운 순위). 완료가 없으면 null
 * @param p90Seconds 90번째 백분위(가장 가까운 순위). 완료가 없으면 null
 * @param outdated 완료했지만 지금 계산 규칙 버전({@link Analysis#CURRENT_VERSION})과 다른 수
 * @param daily 기간의 모든 날짜(오래된 순). 요청이 없는 날은 0
 * @param topFailures 실패 사유 코드별 수(많은 순, 같으면 코드 순) 상위
 * @param topCompanies 분석 요청이 많은 기업(많은 순, 같으면 고유번호 순) 상위. 이름은 부른 쪽이 붙인다
 */
public record AnalysisStats(long requested, long completed, long failed, long inProgress, Double completionRate,
        Long p50Seconds, Long p90Seconds, long outdated, List<Daily> daily, List<FailureCount> topFailures,
        List<CorpCount> topCompanies) {

    private static final int RATE_SCALE = 4;

    public AnalysisStats {
        daily = List.copyOf(daily);
        topFailures = List.copyOf(topFailures);
        topCompanies = List.copyOf(topCompanies);
    }

    /**
     * @param analyses 기간 안에 요청한 분석
     * @param dates 기간의 모든 날짜(오래된 순)
     * @param top 상위 목록의 최대 개수
     */
    public static AnalysisStats of(Collection<Analysis> analyses, List<LocalDate> dates, int top) {
        long completed = count(analyses, AnalysisStatus.COMPLETED);
        long failed = count(analyses, AnalysisStatus.FAILED);
        List<Long> durations = analyses.stream()
                .filter(Analysis::isCompleted)
                .map(Analysis::durationSeconds)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        return new AnalysisStats(analyses.size(), completed, failed,
                analyses.size() - completed - failed, rate(completed, completed + failed),
                nearestRank(durations, 50), nearestRank(durations, 90),
                analyses.stream().filter(a -> a.isCompleted() && a.isOutdated()).count(),
                daily(analyses, dates), topFailures(analyses, top), topCompanies(analyses, top));
    }

    /** 오름차순 값의 p번째 백분위(가장 가까운 순위: ⌈p/100 × n⌉번째). 값이 없으면 null */
    static Long nearestRank(List<Long> ascending, int percentile) {
        if (ascending.isEmpty()) {
            return null;
        }
        int rank = (int) Math.ceil(percentile / 100.0 * ascending.size());
        return ascending.get(Math.max(rank, 1) - 1);
    }

    /** part ÷ whole, 소수 넷째 자리 반올림. whole이 0이면 null */
    static Double rate(long part, long whole) {
        if (whole == 0) {
            return null;
        }
        return BigDecimal.valueOf(part).divide(BigDecimal.valueOf(whole), RATE_SCALE, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static long count(Collection<Analysis> analyses, AnalysisStatus status) {
        return analyses.stream().filter(a -> a.getStatus() == status).count();
    }

    private static List<Daily> daily(Collection<Analysis> analyses, List<LocalDate> dates) {
        Map<LocalDate, List<Analysis>> byDate = analyses.stream()
                .collect(Collectors.groupingBy(a -> a.getCreatedAt().toLocalDate()));
        return dates.stream()
                .map(date -> {
                    List<Analysis> day = byDate.getOrDefault(date, List.of());
                    return new Daily(date, day.size(), count(day, AnalysisStatus.COMPLETED),
                            count(day, AnalysisStatus.FAILED));
                })
                .toList();
    }

    private static List<FailureCount> topFailures(Collection<Analysis> analyses, int top) {
        Map<String, List<Analysis>> byCode = analyses.stream()
                .filter(a -> a.getStatus() == AnalysisStatus.FAILED && a.getErrorCode() != null)
                .collect(Collectors.groupingBy(Analysis::getErrorCode));
        return byCode.entrySet().stream()
                .map(e -> new FailureCount(e.getKey(), e.getValue().size(), e.getValue().stream()
                        .map(Analysis::getUpdatedAt)
                        .max(Comparator.naturalOrder())
                        .orElseThrow()))
                .sorted(Comparator.comparingLong(FailureCount::count).reversed()
                        .thenComparing(FailureCount::errorCode))
                .limit(top)
                .toList();
    }

    private static List<CorpCount> topCompanies(Collection<Analysis> analyses, int top) {
        return analyses.stream()
                .collect(Collectors.groupingBy(Analysis::getCorpCode, Collectors.counting()))
                .entrySet().stream()
                .map(e -> new CorpCount(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(CorpCount::count).reversed().thenComparing(CorpCount::corpCode))
                .limit(top)
                .toList();
    }

    /** 그날 요청한 분석의 수와 그중 지금 완료·실패인 수 */
    public record Daily(LocalDate date, long requested, long completed, long failed) {
    }

    /** @param lastAt 그 코드로 실패한 분석의 가장 최근 updated_at */
    public record FailureCount(String errorCode, long count, LocalDateTime lastAt) {
    }

    public record CorpCount(String corpCode, long count) {
    }

    /** 이름을 붙이지 않은 상위 기업의 고유번호 */
    public List<String> topCorpCodes() {
        return topCompanies.stream().map(CorpCount::corpCode).toList();
    }
}
