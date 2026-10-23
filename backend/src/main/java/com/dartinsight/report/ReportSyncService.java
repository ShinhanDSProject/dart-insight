package com.dartinsight.report;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.Company;
import com.dartinsight.company.CompanyRepository;
import com.dartinsight.dart.dto.DisclosureListResponse;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.report.ReportNameParser.ParsedReportName;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 기업별 정기보고서 목록을 OpenDART에서 받아 저장한다(4.1).
 * 저장한 지 refreshAfter가 지나지 않았으면 다시 부르지 않는다(호출 한도).
 */
@Service
@RequiredArgsConstructor
public class ReportSyncService {

    private static final Logger log = LoggerFactory.getLogger(ReportSyncService.class);

    private final OpenDartClient openDartClient;
    private final CompanyRepository companyRepository;
    private final ReportRepository reportRepository;
    private final ReportProperties properties;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 저장한 목록이 없거나 오래됐으면 다시 받는다. 다시 받다 실패해도 저장된 목록이 있으면 그 목록을 쓴다.
     */
    public SyncResult refreshIfStale(String corpCode) {
        Company company = companyRepository.findById(corpCode)
                .orElseThrow(() -> new ApiException(ErrorCode.COMPANY_NOT_FOUND));
        // DB(DATETIME(6))에 저장되는 정밀도에 맞춘다
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        LocalDateTime fetchedAt = company.getReportsFetchedAt();
        if (fetchedAt != null && fetchedAt.isAfter(now.minus(properties.refreshAfter()))) {
            return SyncResult.notFetched();
        }

        List<DisclosureListResponse.Item> items;
        try {
            items = openDartClient.listPeriodicDisclosures(corpCode,
                    LocalDate.of(properties.listStartYear(), 1, 1), now.toLocalDate());
        } catch (ApiException e) {
            if (fetchedAt != null && reportRepository.existsByCorpCode(corpCode)) {
                log.warn("정기보고서 목록을 다시 받지 못해 저장된 목록을 씁니다: {} {}", corpCode, e.errorCode());
                return SyncResult.usedCache(e.errorCode());
            }
            throw e;
        }
        try {
            return transactionTemplate.execute(status -> save(corpCode, items, now));
        } catch (DataIntegrityViolationException e) {
            // 같은 기업의 목록을 동시에 처음 받으면 같은 접수번호를 두 번 넣으려 할 수 있다. 다시 저장하면 있는 행을 고친다
            log.info("정기보고서 목록을 동시에 저장해 다시 저장합니다: {}", corpCode);
            return transactionTemplate.execute(status -> save(corpCode, items, now));
        }
    }

    private SyncResult save(String corpCode, List<DisclosureListResponse.Item> items, LocalDateTime now) {
        int created = 0;
        int updated = 0;
        int skipped = 0;
        for (DisclosureListResponse.Item item : items) {
            Optional<ParsedReportName> parsed = ReportNameParser.parse(item.reportName(), item.remark());
            LocalDate rceptDt = parseDate(item.rceptDt());
            if (parsed.isEmpty() || rceptDt == null || item.rceptNo() == null || !corpCode.equals(item.corpCode())) {
                skipped++;
                continue;
            }
            String remark = blankToNull(item.remark());
            Optional<Report> existing = reportRepository.findById(item.rceptNo());
            if (existing.isPresent()) {
                if (existing.get().refresh(item.reportName(), parsed.get(), rceptDt, remark, item.filerName(), now)) {
                    updated++;
                }
            } else {
                reportRepository.save(Report.create(item.rceptNo(), corpCode, item.reportName(), parsed.get(),
                        rceptDt, remark, item.filerName(), now));
                created++;
            }
        }
        companyRepository.findById(corpCode).ifPresent(c -> c.markReportsFetched(now));
        log.info("정기보고서 목록 저장 {}: 새 보고서 {}건, 바뀐 보고서 {}건, 지원하지 않는 공시 {}건", corpCode, created,
                updated, skipped);
        return new SyncResult(true, created, updated, skipped, null);
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim(), DateTimeFormatter.BASIC_ISO_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * @param fetched          OpenDART를 불렀는지
     * @param created          새로 저장한 보고서 수
     * @param updated          값이 바뀐 보고서 수
     * @param skipped          지원하지 않아 건너뛴 공시 수(12월 결산이 아닌 보고서, A004·A005 등)
     * @param cacheFallbackError 다시 받지 못해 저장된 목록을 쓴 경우 그 이유
     */
    public record SyncResult(boolean fetched, int created, int updated, int skipped, ErrorCode cacheFallbackError) {

        static SyncResult notFetched() {
            return new SyncResult(false, 0, 0, 0, null);
        }

        static SyncResult usedCache(ErrorCode reason) {
            return new SyncResult(false, 0, 0, 0, reason);
        }
    }
}
