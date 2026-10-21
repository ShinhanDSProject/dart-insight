package com.dartinsight.report;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.Company;
import com.dartinsight.company.CompanyRepository;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 기업별 정기보고서 목록(1.2). 목록이 없거나 오래됐으면 먼저 OpenDART에서 다시 받는다(4.1).
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

    /**
     * @param refreshError 다시 받지 못해 저장된 목록을 돌려줄 때 그 이유. 아니면 null
     */
    public record ReportList(Company company, List<Report> reports, ErrorCode refreshError) {
    }
}
