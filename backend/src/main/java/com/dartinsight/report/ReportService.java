package com.dartinsight.report;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.Company;
import com.dartinsight.company.CompanyRepository;
import java.time.LocalDateTime;
import java.util.List;
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

    public ReportService(ReportSyncService syncService, CompanyRepository companyRepository,
            ReportRepository reportRepository) {
        this.syncService = syncService;
        this.companyRepository = companyRepository;
        this.reportRepository = reportRepository;
    }

    public ReportList list(String corpCode) {
        ReportSyncService.SyncResult sync = syncService.refreshIfStale(corpCode);
        Company company = companyRepository.findById(corpCode)
                .orElseThrow(() -> new ApiException(ErrorCode.COMPANY_NOT_FOUND));
        List<Report> reports = company.getReportsFetchedAt() == null ? List.of()
                : reportRepository.findByCorpCodeAndLastSeenAtGreaterThanEqualOrderByPeriodEndDescRceptDtDesc(
                        corpCode, company.getReportsFetchedAt());
        return new ReportList(company, reports, sync.cacheFallbackError());
    }

    public ReportDetail get(String rceptNo) {
        Report report = reportRepository.findById(rceptNo)
                .orElseThrow(() -> new ApiException(ErrorCode.REPORT_NOT_FOUND));
        Company company = companyRepository.findById(report.getCorpCode())
                .orElseThrow(() -> new ApiException(ErrorCode.COMPANY_NOT_FOUND));
        LocalDateTime fetchedAt = company.getReportsFetchedAt();
        boolean latest = fetchedAt == null || !report.getLastSeenAt().isBefore(fetchedAt);
        return new ReportDetail(company, report, latest);
    }

    /**
     * @param latest 마지막으로 받은 OpenDART 최신 목록에 있는지. 정정 공시로 대체됐으면 false
     */
    public record ReportDetail(Company company, Report report, boolean latest) {
    }

    /**
     * @param refreshError 다시 받지 못해 저장된 목록을 돌려줄 때 그 이유. 아니면 null
     */
    public record ReportList(Company company, List<Report> reports, ErrorCode refreshError) {
    }
}
