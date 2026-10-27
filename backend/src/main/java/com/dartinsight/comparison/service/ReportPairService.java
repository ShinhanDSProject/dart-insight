package com.dartinsight.comparison.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.domain.ReportType;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 비교 보고서 쌍 고르기(2.1). 현재 보고서는 그대로 두고, 비교 기준에 따라 이전 보고서만 정한다.
 * 이전 보고서는 OpenDART 최신 목록(정정 공시는 최종본)에서만 고른다.
 */
@Service
@RequiredArgsConstructor
public class ReportPairService {

    private final ReportService reportService;

    public ReportPair findPair(String corpCode, ComparisonBasis basis, String currentRceptNo) {
        if (basis == ComparisonBasis.CUSTOM) {
            throw ApiException.invalidInput("basis", "YOY 또는 PREV만 쓸 수 있습니다. 직접 선택은 목록에서 고릅니다.");
        }
        List<Report> latest = reportService.list(corpCode).reports();
        Report current = currentRceptNo == null || currentRceptNo.isBlank()
                ? latest.stream().findFirst().orElse(null)
                : findCurrent(corpCode, currentRceptNo.trim());
        if (current == null) {
            return new ReportPair(basis, null, null, PairReason.NO_REPORTS);
        }

        Target target = target(basis, current);
        Optional<Report> previous = latest.stream()
                .filter(r -> r.getReportType() == target.type() && r.getFiscalYear() == target.fiscalYear())
                .findFirst();
        return previous
                .map(p -> new ReportPair(basis, current, p, null))
                .orElseGet(() -> new ReportPair(basis, current, null, PairReason.NO_BASE_REPORT));
    }

    private Report findCurrent(String corpCode, String rceptNo) {
        Report report = reportService.report(rceptNo);
        if (!report.getCorpCode().equals(corpCode)) {
            throw new ApiException(ErrorCode.REPORT_NOT_FOUND);
        }
        return report;
    }

    /** 비교 기준에 따라 찾을 이전 보고서의 종류와 사업연도. */
    static Target target(ComparisonBasis basis, Report current) {
        int year = current.getFiscalYear();
        if (basis == ComparisonBasis.YOY) {
            return new Target(current.getReportType(), year - 1);
        }
        return switch (current.getReportType()) {
            case Q1 -> new Target(ReportType.ANNUAL, year - 1);
            case HALF -> new Target(ReportType.Q1, year);
            case Q3 -> new Target(ReportType.HALF, year);
            case ANNUAL -> new Target(ReportType.Q3, year);
        };
    }

    /** 이전 보고서가 현재 보고서의 비교 기준(전년 동기·직전 기간) 보고서인지. 직접 선택은 늘 true */
    public static boolean matchesBasis(ComparisonBasis basis, Report current, Report previous) {
        if (basis == ComparisonBasis.CUSTOM) {
            return true;
        }
        Target target = target(basis, current);
        return previous.getReportType() == target.type() && previous.getFiscalYear() == target.fiscalYear();
    }

    record Target(ReportType type, int fiscalYear) {
    }

    public enum PairReason {
        NO_REPORTS("이 기업의 정기보고서가 없습니다."),
        NO_BASE_REPORT("비교 기준에 맞는 이전 보고서가 목록에 없습니다. 직접 선택으로 다른 보고서를 고를 수 있습니다.");

        private final String message;

        PairReason(String message) {
            this.message = message;
        }

        public String message() {
            return message;
        }
    }

    /**
     * @param previous 비교 기준에 맞는 이전 보고서. 없으면 null이고 reason에 이유가 있다
     */
    public record ReportPair(ComparisonBasis basis, Report current, Report previous, PairReason reason) {
    }
}
