package com.dartinsight.season.domain;

import com.dartinsight.report.domain.ReportType;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.Optional;
import java.util.stream.IntStream;
import java.util.stream.Stream;

/**
 * 시즌: 정기보고서 종류와 사업연도(예: 2026 반기). 같은 종류의 전년 보고서와 비교한다(ADR-0037).
 * 12월 결산만 다루므로 기간 끝은 사업연도의 3·6·9·12월 말이다.
 */
public record Season(ReportType reportType, int fiscalYear) {

    /** 제출 기한(기간 끝 뒤 날수). 사업보고서 90일, 분기·반기보고서 45일(자본시장법 제159조·제160조) */
    static final int ANNUAL_DEADLINE_DAYS = 90;
    static final int INTERIM_DEADLINE_DAYS = 45;

    public LocalDate periodEnd() {
        return YearMonth.of(fiscalYear, reportType.periodEndMonth()).atEndOfMonth();
    }

    public LocalDate deadline() {
        return periodEnd().plusDays(reportType == ReportType.ANNUAL ? ANNUAL_DEADLINE_DAYS : INTERIM_DEADLINE_DAYS);
    }

    /** 제출 기한에서 graceDays가 지나 계산할 수 있는 가장 최근 시즌 */
    public static Optional<Season> latestDue(LocalDate today, int graceDays) {
        return IntStream.rangeClosed(today.getYear() - 1, today.getYear()).boxed()
                .flatMap(year -> Stream.of(ReportType.values()).map(type -> new Season(type, year)))
                .filter(season -> !season.deadline().plusDays(graceDays).isAfter(today))
                .max(Comparator.comparing(Season::periodEnd));
    }
}
