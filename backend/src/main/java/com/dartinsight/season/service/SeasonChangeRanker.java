package com.dartinsight.season.service;

import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.AnalysisService;
import com.dartinsight.analysis.service.TextComparisonService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.document.service.DocumentService;
import com.dartinsight.featured.service.FeaturedCompanyService;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.season.config.SeasonChangeProperties;
import com.dartinsight.season.domain.Season;
import com.dartinsight.season.domain.SeasonChange;
import com.dartinsight.season.domain.SeasonScore;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 이번 시즌 변화가 큰 기업 계산(1.7, #420, ADR-0037). 대표 기업마다 시즌 보고서와 전년 보고서를 문장 비교만 해(LLM 없음)
 * 점수를 매기고, 상위 10곳만 요약까지 있는 전년 동기 분석을 요청한다. 외부 호출은 트랜잭션 밖에서 한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class SeasonChangeRanker {

    static final int TOP = 10;

    private static final Logger log = LoggerFactory.getLogger(SeasonChangeRanker.class);

    private final FeaturedCompanyService featuredCompanyService;
    private final ReportService reportService;
    private final TextComparisonService textComparisonService;
    private final DocumentService documentService;
    private final AnalysisService analysisService;
    private final AnalysisResultService analysisResultService;
    private final SeasonChangeService seasonChangeService;
    private final SeasonChangeProperties properties;
    private final Clock clock;

    // 대표 기업 목록(시작할 때 받음)이 먼저 있어야 해서 시작 뒤 잠시 기다린다. 계산한 시즌은 다시 계산하지 않는다
    @Scheduled(initialDelayString = "${app.season-changes.first-check-delay:2m}",
            fixedDelayString = "${app.season-changes.check-interval:1d}")
    public void check() {
        if (!properties.enabled()) {
            return;
        }
        try {
            Season.latestDue(LocalDate.now(clock), properties.graceDays()).ifPresent(this::computeIfMissing);
            seasonChangeService.seasons().stream().findFirst().ifPresent(this::retryAnalyses);
        } catch (RuntimeException e) {
            log.error("시즌 변화 순위를 계산하지 못했습니다", e);
        }
    }

    /** 이 시즌을 아직 계산하지 않았으면 계산한다. 계산했으면 true */
    public boolean computeIfMissing(Season season) {
        if (seasonChangeService.exists(season)) {
            return false;
        }
        List<String> candidates = featuredCompanyService.corpCodes();
        if (candidates.isEmpty()) {
            log.info("대표 기업 목록이 없어 {} {} 시즌 순위를 계산하지 않았습니다", season.fiscalYear(), season.reportType());
            return false;
        }
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        log.info("{} {} 시즌 순위 계산 시작: 대표 기업 {}곳", season.fiscalYear(), season.reportType(), candidates.size());
        List<SeasonChange> rows = new ArrayList<>(candidates.size());
        for (String corpCode : candidates) {
            rows.add(measure(season, corpCode, candidates.size(), now));
        }
        for (SeasonChange top : seasonChangeService.saveSeason(rows, TOP)) {
            requestAnalysis(top);
        }
        return true;
    }

    /**
     * 상위 기업 중 분석이 없거나 완료되지 않은 줄(요청 실패, 분석 실패, 서버가 멈춰 대기·진행 중으로 남은 분석)은 다시 요청한다.
     * 요청은 같은 쌍을 다시 쓰므로 정말 진행 중이면 같은 분석이 돌아오고, 오래 멈춘 분석은 실패로 바뀌고 새로 만든다(4.3).
     * 계산한 시즌은 다시 계산하지 않으므로, 이렇게 하지 않으면 그 줄은 결과 화면으로 가지 못한 채 남는다.
     */
    public void retryAnalyses(Season season) {
        for (SeasonChange top : seasonChangeService.top(season, TOP)) {
            if (top.getAnalysisId() == null
                    || analysisResultService.get(top.getAnalysisId()).getStatus() != AnalysisStatus.COMPLETED) {
                requestAnalysis(top);
            }
        }
    }

    private SeasonChange measure(Season season, String corpCode, int candidateCount, LocalDateTime now) {
        Report current = null;
        Report previous = null;
        try {
            List<Report> reports = reportService.list(corpCode).reports();
            current = find(reports, season.reportType(), season.fiscalYear()).orElse(null);
            previous = find(reports, season.reportType(), season.fiscalYear() - 1).orElse(null);
            if (current == null || previous == null) {
                return SeasonChange.noReport(season, corpCode, candidateCount, now);
            }
            TextComparison comparison = textComparisonService.compare(previous, current);
            if (comparison.status() != TextStatus.COMPLETED) {
                return SeasonChange.failed(season, corpCode, previous.getRceptNo(), current.getRceptNo(),
                        comparison.message(), candidateCount, now);
            }
            int previousBlocks = blocks(previous);
            int currentBlocks = blocks(current);
            if (previousBlocks + currentBlocks == 0) {
                return SeasonChange.failed(season, corpCode, previous.getRceptNo(), current.getRceptNo(),
                        "원문에 문단·표가 없어요.", candidateCount, now);
            }
            return SeasonChange.scored(season, corpCode, previous.getRceptNo(), current.getRceptNo(),
                    SeasonScore.of(comparison.rows(), previousBlocks, currentBlocks), candidateCount, now);
        } catch (RuntimeException e) {
            // 한 기업이 실패해도 나머지는 계속 잰다. ApiException 메시지는 사용자에게 보여 줄 수 있는 사유다
            log.warn("시즌 변화를 재지 못했습니다: {} {}", corpCode, e.getMessage());
            return SeasonChange.failed(season, corpCode, previous == null ? null : previous.getRceptNo(),
                    current == null ? null : current.getRceptNo(),
                    e instanceof ApiException ? e.getMessage() : "문장을 비교하지 못했어요.", candidateCount, now);
        }
    }

    private void requestAnalysis(SeasonChange top) {
        try {
            long analysisId = analysisService.request(top.getCorpCode(), top.getCurrentRceptNo(),
                    top.getPreviousRceptNo(), ComparisonBasis.YOY).analysis().getId();
            seasonChangeService.linkAnalysis(top.getId(), analysisId);
        } catch (ApiException e) {
            log.warn("상위 기업 분석을 요청하지 못했습니다: {} {}", top.getCorpCode(), e.errorCode());
        }
    }

    /** 같은 종류·사업연도 중 가장 나중에 낸 것(목록은 기간·접수일 최근 순) */
    private static Optional<Report> find(List<Report> reports, ReportType type,
            int fiscalYear) {
        return reports.stream()
                .filter(r -> r.getReportType() == type && r.getFiscalYear() == fiscalYear)
                .findFirst();
    }

    private int blocks(Report report) {
        return documentService.find(report.getRceptNo())
                .filter(d -> d.getStatus().usable())
                .map(d -> documentService.blocks(d).size())
                .orElse(0);
    }
}
