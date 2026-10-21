package com.dartinsight.report;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 보고서명(report_nm)에서 종류·대상 기간·정정 여부를 읽는다.
 * 예: "반기보고서 (2026.06)", "[기재정정]분기보고서 (2025.09)", "사업보고서 (2025.12)"
 *
 * <p>12월 결산 회사의 보고서만 지원한다(분석 대상 기업 범위 잠정안). 결산월이 다른 보고서와
 * 사업·반기·분기보고서가 아닌 정기공시(A004·A005 등)는 빈 값을 돌려준다.
 */
public final class ReportNameParser {

    private static final Pattern NAME = Pattern.compile(
            "^\\s*(?:\\[(?<prefix>[^\\]]*)\\]\\s*)*(?<kind>사업보고서|반기보고서|분기보고서)\\s*\\((?<year>\\d{4})\\.(?<month>\\d{2})\\)");
    private static final Pattern PREFIXES = Pattern.compile("\\[([^\\]]*)\\]");

    private ReportNameParser() {
    }

    public record ParsedReportName(ReportType type, int fiscalYear, LocalDate periodEnd, Correction correction) {
    }

    /**
     * @param remark OpenDART 비고(rm). '정'이 들어 있으면 정정 공시다.
     */
    public static Optional<ParsedReportName> parse(String reportName, String remark) {
        if (reportName == null) {
            return Optional.empty();
        }
        Matcher m = NAME.matcher(reportName);
        if (!m.find()) {
            return Optional.empty();
        }
        int year = Integer.parseInt(m.group("year"));
        int month = Integer.parseInt(m.group("month"));
        Optional<ReportType> type = typeOf(m.group("kind"), month);
        if (type.isEmpty()) {
            return Optional.empty();
        }
        LocalDate periodEnd = YearMonth.of(year, month).atEndOfMonth();
        return Optional.of(new ParsedReportName(type.get(), year, periodEnd, correctionOf(reportName, remark)));
    }

    private static Optional<ReportType> typeOf(String kind, int month) {
        return switch (kind) {
            case "사업보고서" -> month == 12 ? Optional.of(ReportType.ANNUAL) : Optional.empty();
            case "반기보고서" -> month == 6 ? Optional.of(ReportType.HALF) : Optional.empty();
            case "분기보고서" -> switch (month) {
                case 3 -> Optional.of(ReportType.Q1);
                case 9 -> Optional.of(ReportType.Q3);
                default -> Optional.empty();
            };
            default -> Optional.empty();
        };
    }

    private static Correction correctionOf(String reportName, String remark) {
        Matcher prefixes = PREFIXES.matcher(reportName);
        while (prefixes.find()) {
            if (prefixes.group(1).contains("정정")) {
                return Correction.CORRECTED;
            }
        }
        if (remark != null && remark.contains("정")) {
            return Correction.CORRECTED;
        }
        return Correction.ORIGINAL;
    }
}
