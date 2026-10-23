package com.dartinsight.report;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.Company;
import com.dartinsight.company.CompanyRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * 기업별 정기보고서 목록(1.2)과 보고서 메타데이터(1.3).
 * 목록은 없거나 오래됐으면 먼저 OpenDART에서 다시 받는다(4.1). 메타데이터는 저장된 보고서만 돌려준다.
 */
@Service
public class ReportService {

    private final ReportSyncService syncService;
    private final CompanyRepository companyRepository;
    private final ReportRepository reportRepository;
    private final FinancialDataStatusProvider financialDataStatusProvider;

    public ReportService(ReportSyncService syncService, CompanyRepository companyRepository,
            ReportRepository reportRepository, FinancialDataStatusProvider financialDataStatusProvider) {
        this.syncService = syncService;
        this.companyRepository = companyRepository;
        this.reportRepository = reportRepository;
        this.financialDataStatusProvider = financialDataStatusProvider;
    }

    /** 보고서별 재무 자료 상태(접수번호 → 상태). OpenDART를 부르지 않는다. */
    public Map<String, FinancialDataStatus> financialDataStatuses(String corpCode, List<Report> reports) {
        return financialDataStatusProvider.statuses(corpCode, reports);
    }

    public ReportList list(String corpCode) {
        ReportSyncService.SyncResult sync = syncService.refreshIfStale(corpCode);
        Company company = companyRepository.findById(corpCode)
                .orElseThrow(() -> new ApiException(ErrorCode.COMPANY_NOT_FOUND));
        List<Report> reports = company.getReportsFetchedAt() == null ? List.of()
                : reportRepository.findByCorpCodeAndLastSeenAtGreaterThanEqualOrderByPeriodEndDescRceptDtDesc(
                        corpCode, company.getReportsFetchedAt());
        return new ReportList(company, reports, financialDataStatuses(corpCode, reports), sync.cacheFallbackError());
    }

    /** 저장된 보고서. 없으면 404 */
    public Report report(String rceptNo) {
        return reportRepository.findById(rceptNo).orElseThrow(() -> new ApiException(ErrorCode.REPORT_NOT_FOUND));
    }

    public ReportDetail get(String rceptNo) {
        Report report = reportRepository.findById(rceptNo)
                .orElseThrow(() -> new ApiException(ErrorCode.REPORT_NOT_FOUND));
        Company company = companyRepository.findById(report.getCorpCode())
                .orElseThrow(() -> new ApiException(ErrorCode.COMPANY_NOT_FOUND));
        LocalDateTime fetchedAt = company.getReportsFetchedAt();
        boolean latest = fetchedAt == null || !report.getLastSeenAt().isBefore(fetchedAt);
        FinancialDataStatus status = financialDataStatuses(company.getCorpCode(), List.of(report))
                .get(report.getRceptNo());
        return new ReportDetail(company, report, latest, status);
    }

    /**
     * @param latest 마지막으로 받은 OpenDART 최신 목록에 있는지. 정정 공시로 대체됐으면 false
     */
    public record ReportDetail(Company company, Report report, boolean latest,
            FinancialDataStatus financialDataStatus) {
    }

    /**
     * @param refreshError 다시 받지 못해 저장된 목록을 돌려줄 때 그 이유. 아니면 null
     */
    public record ReportList(Company company, List<Report> reports,
            Map<String, FinancialDataStatus> financialDataStatuses, ErrorCode refreshError) {
    }
}
