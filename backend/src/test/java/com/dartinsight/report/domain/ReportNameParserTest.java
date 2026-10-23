package com.dartinsight.report.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ReportNameParserTest {

    @ParameterizedTest
    @CsvSource({
            "'사업보고서 (2025.12)', ANNUAL, 2025, 2025-12-31",
            "'반기보고서 (2026.06)', HALF, 2026, 2026-06-30",
            "'분기보고서 (2026.03)', Q1, 2026, 2026-03-31",
            "'분기보고서 (2025.09)', Q3, 2025, 2025-09-30"
    })
    void readsTypeAndPeriod(String name, ReportType type, int year, LocalDate periodEnd) {
        ParsedReportName parsed = ReportNameParser.parse(name, "").orElseThrow();

        assertThat(parsed).isEqualTo(new ParsedReportName(type, year, periodEnd, Correction.ORIGINAL));
    }

    @Test
    void correctionPrefixMeansCorrected() {
        assertThat(ReportNameParser.parse("[기재정정]반기보고서 (2026.06)", "").orElseThrow().correction())
                .isEqualTo(Correction.CORRECTED);
        assertThat(ReportNameParser.parse("[첨부정정] 사업보고서 (2025.12)", null).orElseThrow().correction())
                .isEqualTo(Correction.CORRECTED);
    }

    @Test
    void remarkWithJeongIsNotGuessed() {
        // 비고 '정'은 제출 뒤 정정신고가 있었다는 뜻이라 이 보고서가 정정본인지 알 수 없다
        assertThat(ReportNameParser.parse("분기보고서 (2026.03)", "정").orElseThrow().correction())
                .isEqualTo(Correction.UNKNOWN);
        assertThat(ReportNameParser.parse("[기재정정]분기보고서 (2026.03)", "정").orElseThrow().correction())
                .isEqualTo(Correction.CORRECTED);
        assertThat(ReportNameParser.parse("분기보고서 (2026.03)", "연").orElseThrow().correction())
                .isEqualTo(Correction.ORIGINAL);
    }

    @Test
    void otherPrefixIsNotCorrection() {
        assertThat(ReportNameParser.parse("[첨부추가]사업보고서 (2025.12)", "").orElseThrow().correction())
                .isEqualTo(Correction.ORIGINAL);
    }

    @Test
    void nonDecemberFiscalYearIsNotSupported() {
        assertThat(ReportNameParser.parse("사업보고서 (2026.03)", "")).isEmpty();
        assertThat(ReportNameParser.parse("분기보고서 (2025.06)", "")).isEmpty();
        assertThat(ReportNameParser.parse("반기보고서 (2025.09)", "")).isEmpty();
    }

    @Test
    void otherPeriodicDisclosuresAreNotSupported() {
        assertThat(ReportNameParser.parse("소액공모법인결산서류 (2025.12)", "")).isEmpty();
        assertThat(ReportNameParser.parse("등록법인결산서류(자본시장법이전) (2008.12)", "")).isEmpty();
        assertThat(ReportNameParser.parse(null, "")).isEmpty();
    }
}
