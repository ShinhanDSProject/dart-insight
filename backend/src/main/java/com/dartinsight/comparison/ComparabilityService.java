package com.dartinsight.comparison;

import com.dartinsight.comparison.StatementRules.StatementRule;
import com.dartinsight.financial.domain.FinancialStatementFetch;
import com.dartinsight.financial.service.FinancialStatementService;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportService.ReportDetail;
import com.dartinsight.report.domain.ReportType;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 비교 가능성 검증(2.2). 비교할 수 없으면 사유와 다음 행동을 돌려주고, 다른 보고서로 대신하거나 수치를 만들지 않는다.
 * 필요하면 두 보고서의 재무제표를 OpenDART에서 받는다(4.5, 저장된 결과가 있으면 다시 부르지 않음).
 */
@Service
@RequiredArgsConstructor
public class ComparabilityService {

    private final ReportService reportService;
    private final FinancialStatementService financialStatementService;

    public ComparabilityResult check(String corpCode, String currentRceptNo, String previousRceptNo,
            ComparisonBasis basis) {
        ReportDetail current = reportService.get(currentRceptNo);
        ReportDetail previous = reportService.get(previousRceptNo);
        Report cur = current.report();
        Report prev = previous.report();
        List<Reason> reasons = new ArrayList<>();

        Check company = checkCompany(corpCode, current, previous, reasons);
        Check period = checkPeriod(basis, cur, prev, reasons);
        Check correction = checkCorrection(current, previous, reasons);
        List<StatementRule> statements = StatementRules.rules(prev.getReportType(), cur.getReportType());

        DataResult data = null;
        Check financialBasis;
        Check dataReady;
        if (company.status() == CheckStatus.FAIL || period.status() == CheckStatus.FAIL) {
            String skipped = "기업이나 기간이 맞지 않아 확인하지 않았어요.";
            financialBasis = new Check(CheckItem.FINANCIAL_BASIS, CheckStatus.SKIPPED, skipped);
            dataReady = new Check(CheckItem.DATA_READY, CheckStatus.SKIPPED, skipped);
        } else {
            data = resolveData(cur, prev);
            financialBasis = checkFinancialBasis(data, reasons);
            dataReady = checkDataReady(data, reasons);
        }

        boolean comparable = reasons.isEmpty();
        Level level = !comparable ? Level.NOT_COMPARABLE
                : statements.stream().allMatch(StatementRule::comparable) ? Level.FULL : Level.PARTIAL;
        return new ComparabilityResult(comparable, level, comparable ? data.fsDiv() : null, cur, prev,
                statements, List.of(company, period, financialBasis, correction, dataReady), List.copyOf(reasons),
                comparable ? data.currentFetch() : null, comparable ? data.previousFetch() : null);
    }

    private static Check checkCompany(String corpCode, ReportDetail current, ReportDetail previous,
            List<Reason> reasons) {
        boolean same = corpCode.equals(current.report().getCorpCode())
                && corpCode.equals(previous.report().getCorpCode());
        if (same) {
            return new Check(CheckItem.COMPANY, CheckStatus.OK,
                    "두 보고서 모두 " + current.company().getCorpName() + "의 보고서예요.");
        }
        reasons.add(new Reason("DIFFERENT_COMPANY", "두 보고서의 기업이 달라요.", "같은 기업의 보고서를 고르세요."));
        return new Check(CheckItem.COMPANY, CheckStatus.FAIL,
                previous.company().getCorpName() + " / " + current.company().getCorpName());
    }

    private static Check checkPeriod(ComparisonBasis basis, Report cur, Report prev, List<Reason> reasons) {
        String detail = periodLabel(prev) + " → " + periodLabel(cur) + " (" + basisLabel(basis) + ")";
        if (cur.getRceptNo().equals(prev.getRceptNo())) {
            reasons.add(new Reason("SAME_REPORT", "같은 보고서끼리는 비교할 수 없어요.", "비교 보고서를 다시 고르세요."));
            return new Check(CheckItem.REPORT_PERIOD, CheckStatus.FAIL, detail);
        }
        if (!prev.getPeriodEnd().isBefore(cur.getPeriodEnd())) {
            reasons.add(new Reason("PREVIOUS_NOT_EARLIER", "비교 보고서는 현재 보고서보다 앞선 기간이어야 해요.",
                    "비교 보고서를 다시 고르세요."));
            return new Check(CheckItem.REPORT_PERIOD, CheckStatus.FAIL, detail);
        }
        List<String> warnings = new ArrayList<>();
        if (!ReportPairService.matchesBasis(basis, cur, prev)) {
            warnings.add("고른 보고서가 " + basisLabel(basis) + " 기준과 달라 직접 고른 것으로 봐요.");
        }
        if (prev.getReportType() != cur.getReportType()) {
            boolean bothInterim = prev.getReportType() != ReportType.ANNUAL && cur.getReportType() != ReportType.ANNUAL;
            warnings.add(bothInterim ? "보고서 종류가 달라 재무상태표와 3개월 손익만 비교해요."
                    : "보고서 종류가 달라 재무상태표만 비교해요.");
        }
        return warnings.isEmpty() ? new Check(CheckItem.REPORT_PERIOD, CheckStatus.OK, detail)
                : new Check(CheckItem.REPORT_PERIOD, CheckStatus.WARN, detail + " · " + String.join(" ", warnings));
    }

    private static Check checkCorrection(ReportDetail current, ReportDetail previous, List<Reason> reasons) {
        List<String> replaced = new ArrayList<>();
        if (!previous.latest()) {
            replaced.add("비교 보고서");
        }
        if (!current.latest()) {
            replaced.add("현재 보고서");
        }
        if (!replaced.isEmpty()) {
            reasons.add(new Reason("REPLACED_BY_CORRECTION", String.join("와 ", replaced) + "는 정정 공시로 대체된 보고서예요.",
                    "목록에서 정정본(최종)을 고르세요."));
            return new Check(CheckItem.CORRECTION, CheckStatus.FAIL,
                    String.join("와 ", replaced) + "가 최신 목록에 없어요.");
        }
        Correction p = previous.report().getCorrection();
        Correction c = current.report().getCorrection();
        if (p == Correction.UNKNOWN || c == Correction.UNKNOWN) {
            return new Check(CheckItem.CORRECTION, CheckStatus.WARN, "정정 여부를 확인하지 못한 보고서가 있어요.");
        }
        if (p == Correction.CORRECTED || c == Correction.CORRECTED) {
            String which = p == Correction.CORRECTED && c == Correction.CORRECTED ? "두 보고서 모두"
                    : p == Correction.CORRECTED ? "비교 보고서는" : "현재 보고서는";
            return new Check(CheckItem.CORRECTION, CheckStatus.WARN, which + " 정정본(최종)을 써요.");
        }
        return new Check(CheckItem.CORRECTION, CheckStatus.OK, "두 보고서 모두 정정 없이 원본이에요.");
    }

    /** 연결 재무제표를 먼저 보고, 둘 다 있지 않으면 별도 재무제표를 본다. */
    private DataResult resolveData(Report cur, Report prev) {
        Optional<FinancialStatementFetch> curCfs = financialStatementService.fetch(cur, FsDiv.CFS);
        Optional<FinancialStatementFetch> prevCfs = financialStatementService.fetch(prev, FsDiv.CFS);
        if (usable(curCfs, cur) && usable(prevCfs, prev)) {
            return new DataResult(FsDiv.CFS, curCfs.get(), prevCfs.get(), null);
        }
        Optional<FinancialStatementFetch> curOfs = financialStatementService.fetch(cur, FsDiv.OFS);
        Optional<FinancialStatementFetch> prevOfs = financialStatementService.fetch(prev, FsDiv.OFS);
        if (usable(curOfs, cur) && usable(prevOfs, prev)) {
            return new DataResult(FsDiv.OFS, curOfs.get(), prevOfs.get(), null);
        }
        List<Reason> failures = new ArrayList<>();
        dataFailure("비교 보고서", prev, prevCfs, prevOfs).ifPresent(failures::add);
        dataFailure("현재 보고서", cur, curCfs, curOfs).ifPresent(failures::add);
        if (failures.isEmpty()) {
            failures.add(new Reason("NO_COMMON_BASIS", "두 보고서에 같은 기준(연결·별도)의 재무제표가 없어요.",
                    "같은 기준의 재무제표가 있는 다른 보고서를 고르세요."));
        }
        return new DataResult(null, null, null, failures);
    }

    private static boolean usable(Optional<FinancialStatementFetch> fetch, Report report) {
        return fetch.isPresent() && fetch.get().hasData() && report.getRceptNo().equals(fetch.get().getRceptNo());
    }

    private static Optional<Reason> dataFailure(String role, Report report, Optional<FinancialStatementFetch> cfs,
            Optional<FinancialStatementFetch> ofs) {
        boolean hasData = cfs.map(FinancialStatementFetch::hasData).orElse(false)
                || ofs.map(FinancialStatementFetch::hasData).orElse(false);
        if (!hasData) {
            return Optional.of(new Reason("NO_FINANCIAL_DATA",
                    role + "(" + report.getReportName() + ")의 재무제표가 OpenDART에 없어요.",
                    "다른 보고서를 고르세요. 재무제표 API는 2015 사업연도부터 제공해요."));
        }
        if (!usable(cfs, report) && !usable(ofs, report)) {
            return Optional.of(new Reason("DATA_VERSION_MISMATCH",
                    role + "의 OpenDART 재무 자료가 다른 접수번호(정정본) 기준이에요.",
                    "보고서 목록을 새로 불러와 정정본을 고르세요."));
        }
        return Optional.empty();
    }

    private Check checkFinancialBasis(DataResult data, List<Reason> reasons) {
        if (data.failures() != null) {
            return new Check(CheckItem.FINANCIAL_BASIS, CheckStatus.FAIL, "두 보고서에 공통으로 쓸 재무제표가 없어요.");
        }
        Set<String> currencies = new TreeSet<>(financialStatementService.currencies(data.currentFetch()));
        Set<String> previousCurrencies = new TreeSet<>(financialStatementService.currencies(data.previousFetch()));
        String basisName = data.fsDiv() == FsDiv.CFS ? "연결" : "별도";
        if (currencies.size() > 1 || !currencies.equals(previousCurrencies)) {
            reasons.add(new Reason("CURRENCY_MISMATCH", "두 보고서의 통화가 달라요.", "같은 통화로 작성된 보고서를 고르세요."));
            return new Check(CheckItem.FINANCIAL_BASIS, CheckStatus.FAIL,
                    basisName + ", 통화 " + previousCurrencies + " / " + currencies);
        }
        String unit = currencies.isEmpty() ? "통화 확인 안 됨"
                : "KRW".equals(currencies.iterator().next()) ? "원(KRW)" : currencies.iterator().next();
        if (data.fsDiv() == FsDiv.OFS) {
            return new Check(CheckItem.FINANCIAL_BASIS, CheckStatus.WARN,
                    "별도, " + unit + " · 두 보고서에 연결 재무제표가 함께 있지 않아 별도 기준으로 비교해요.");
        }
        return new Check(CheckItem.FINANCIAL_BASIS, CheckStatus.OK, "연결, " + unit);
    }

    private static Check checkDataReady(DataResult data, List<Reason> reasons) {
        if (data.failures() != null) {
            reasons.addAll(data.failures());
            return new Check(CheckItem.DATA_READY, CheckStatus.FAIL,
                    String.join(" ", data.failures().stream().map(Reason::message).toList()));
        }
        return new Check(CheckItem.DATA_READY, CheckStatus.OK, "두 보고서의 재무 자료가 있어요.");
    }

    static String periodLabel(Report report) {
        String name = switch (report.getReportType()) {
            case Q1 -> "1분기";
            case HALF -> "반기";
            case Q3 -> "3분기";
            case ANNUAL -> "사업연도";
        };
        return report.getFiscalYear() + " " + name;
    }

    static String basisLabel(ComparisonBasis basis) {
        return switch (basis) {
            case YOY -> "전년 동기";
            case PREV -> "직전 기간";
            case CUSTOM -> "직접 선택";
        };
    }

    private record DataResult(FsDiv fsDiv, FinancialStatementFetch currentFetch,
            FinancialStatementFetch previousFetch, List<Reason> failures) {
    }

    public enum Level {
        /** 다섯 재무제표 모두 비교 */
        FULL,
        /** 기간 길이가 달라 일부 재무제표만 비교 */
        PARTIAL,
        NOT_COMPARABLE
    }

    public enum CheckStatus {
        OK, WARN, FAIL, SKIPPED
    }

    public enum CheckItem {
        COMPANY("기업"),
        REPORT_PERIOD("보고서 종류·기간"),
        FINANCIAL_BASIS("수치 기준(연결·단위)"),
        CORRECTION("정정 여부"),
        DATA_READY("자료 준비 상태");

        private final String label;

        CheckItem(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    public record Check(CheckItem item, CheckStatus status, String detail) {
    }

    public record Reason(String code, String message, String nextAction) {
    }

    /**
     * @param fsDiv          비교에 쓸 재무제표 기준. 비교할 수 없으면 null
     * @param currentFetch   현재 보고서 재무제표(2.4 계산에 씀). 비교할 수 없으면 null
     * @param previousFetch  비교 보고서 재무제표. 비교할 수 없으면 null
     */
    public record ComparabilityResult(boolean comparable, Level level, FsDiv fsDiv, Report current,
            Report previous, List<StatementRule> statements, List<Check> checks, List<Reason> reasons,
            FinancialStatementFetch currentFetch, FinancialStatementFetch previousFetch) {
    }
}
