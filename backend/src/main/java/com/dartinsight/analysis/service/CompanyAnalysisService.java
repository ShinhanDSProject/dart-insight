package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 기업의 이미 끝난 분석 목록(#288). 저장된 분석과 보고서만 읽는다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CompanyAnalysisService {

    private final AnalysisRepository analysisRepository;
    private final CompanyService companyService;
    private final ReportService reportService;

    /**
     * 완료된 분석, 완료 시각이 최근인 것부터 최대 limit개. 같은 보고서 쌍·비교 기준은 가장 최근에 완료된 하나만 둔다.
     * 없는 기업이면 404.
     */
    public List<CompletedAnalysis> recentCompleted(String corpCode, int limit) {
        companyService.get(corpCode);
        Set<PairKey> seen = new HashSet<>();
        List<Analysis> analyses = analysisRepository
                .findByCorpCodeAndStatusOrderByCompletedAtDescIdDesc(corpCode, AnalysisStatus.COMPLETED).stream()
                .filter(a -> seen.add(new PairKey(a.getPreviousRceptNo(), a.getCurrentRceptNo(), a.getBasis())))
                .limit(limit)
                .toList();
        Map<String, Report> reports = reportService.reports(analyses.stream()
                .flatMap(a -> Stream.of(a.getPreviousRceptNo(), a.getCurrentRceptNo()))
                .distinct()
                .toList());
        return analyses.stream()
                .map(a -> new CompletedAnalysis(a, reportOf(reports, a.getPreviousRceptNo()),
                        reportOf(reports, a.getCurrentRceptNo())))
                .toList();
    }

    /** 분석의 두 보고서는 외래 키로 report 표에 있다. 없으면 불변식 위반이다. */
    private static Report reportOf(Map<String, Report> reports, String rceptNo) {
        Report report = reports.get(rceptNo);
        if (report == null) {
            throw new IllegalStateException("분석의 보고서가 저장되어 있지 않습니다: " + rceptNo);
        }
        return report;
    }

    public record CompletedAnalysis(Analysis analysis, Report previous, Report current) {
    }

    private record PairKey(String previousRceptNo, String currentRceptNo, ComparisonBasis basis) {
    }
}
