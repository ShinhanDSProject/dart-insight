package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.AdminAnalysisQuery;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisListing;
import com.dartinsight.analysis.domain.AnalysisPage;
import com.dartinsight.analysis.domain.AnalysisStats;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자가 보는 분석 작업(3.34, FS-72): 기간 집계와 작업 목록. 저장된 분석·기업·보고서만 읽는다.
 * 관리자인지는 SecurityConfig가 /api/admin 아래에서 확인한다(ADR-0040).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AnalysisMonitorService {
    private final AnalysisRepository analysisRepository;
    private final CompanyService companyService;
    private final ReportService reportService;
    private final Clock clock;

    /**
     * [from, to)에 요청한 분석의 집계.
     *
     * @param dates 기간의 모든 날짜(오래된 순)
     * @param top 실패 사유·기업 상위 목록의 최대 개수
     */
    public AnalysisStats stats(LocalDateTime from, LocalDateTime to, List<LocalDate> dates, int top) {
        return AnalysisStats.of(analysisRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to),
                dates, top);
    }

    /** 고유번호 → 기업명(기업 표에 없는 고유번호는 빠짐) */
    public Map<String, String> corpNames(Collection<String> corpCodes) {
        return companyService.getAll(corpCodes).stream()
                .collect(Collectors.toMap(Company::getCorpCode, Company::getCorpName));
    }

    /** 조건이 규칙에 맞지 않으면 400(AdminAnalysisQuery) */
    public AnalysisPage search(String status, Integer days, String q, Integer page, Integer size) {
        AdminAnalysisQuery query = AdminAnalysisQuery.of(status, days, q, page, size);
        Page<Analysis> found = analysisRepository.search(query.status(), query.createdFrom(LocalDate.now(clock)),
                query.analysisId(), query.corpCode(), query.traceId(), query.corpNamePattern(),
                PageRequest.of(query.page().page(), query.page().size()));
        List<Analysis> analyses = found.getContent();
        Map<String, String> names = corpNames(analyses.stream().map(Analysis::getCorpCode).distinct().toList());
        Map<String, Report> reports = reportService.reports(analyses.stream()
                .flatMap(a -> Stream.of(a.getCurrentRceptNo(), a.getPreviousRceptNo()))
                .distinct()
                .toList());
        List<AnalysisListing> items = analyses.stream()
                .map(a -> new AnalysisListing(a, names.get(a.getCorpCode()), reports.get(a.getCurrentRceptNo()),
                        reports.get(a.getPreviousRceptNo())))
                .toList();
        return new AnalysisPage(query.page().page(), query.page().size(), found.getTotalElements(), items);
    }
}
