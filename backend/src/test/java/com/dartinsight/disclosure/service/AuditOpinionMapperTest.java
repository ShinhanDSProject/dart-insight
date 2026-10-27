package com.dartinsight.disclosure.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.dart.client.OpenDartClient.PeriodicReportInfoPage;
import com.dartinsight.dart.dto.AuditOpinionItem;
import com.dartinsight.disclosure.domain.AuditOpinionRow;
import com.dartinsight.disclosure.domain.AuditOpinions;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AuditOpinionMapperTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 27, 9, 0);
    private static final ParsedReportName FY2025 = new ParsedReportName(ReportType.ANNUAL, 2025,
            LocalDate.of(2025, 12, 31), Correction.ORIGINAL);
    private static final String RCEPT_NO = "20260310000001";

    private static AuditOpinions map(List<AuditOpinionItem> items) {
        return AuditOpinionMapper.toOpinions(RCEPT_NO, FY2025, new PeriodicReportInfoPage<>(false, items), NOW);
    }

    @Test
    @DisplayName("이 보고서 접수번호의 행만 쓰고, 사업연도 공백을 빼고 '-'는 null로 둔다")
    void usesRowsOfThisReport() {
        AuditOpinions opinions = map(List.of(
                new AuditOpinionItem("20260101000009", "제60기\n(당기)", "다른회계법인", "적정의견", "2025-12-31"),
                new AuditOpinionItem(RCEPT_NO, "제60기\n(당기)", " 대주회계법인 ", "의견거절", "2025-12-31"),
                new AuditOpinionItem(RCEPT_NO, "제59기 (전기)", "현대회계법인", "-", "2025-12-31")));

        assertThat(opinions.available()).isTrue();
        assertThat(opinions.sourceRceptNo()).isNull();
        assertThat(opinions.rows()).containsExactly(
                new AuditOpinionRow("제60기(당기)", "대주회계법인", "의견거절"),
                new AuditOpinionRow("제59기(전기)", "현대회계법인", null));
    }

    @Test
    @DisplayName("이 보고서의 행이 없으면 첫 행의 접수번호(정정본)를 근거로 둔다")
    void fallsBackToFirstRceptNo() {
        AuditOpinions opinions = map(List.of(
                new AuditOpinionItem("20260401000002", "제60기(당기)", "대주회계법인", "적정의견", "2025-12-31")));

        assertThat(opinions.available()).isTrue();
        assertThat(opinions.sourceRceptNo()).isEqualTo("20260401000002");
    }

    @Test
    @DisplayName("접수번호가 없는 행만 있거나 결산기준일이 대상 기간 끝과 다르면 자료 없음이다")
    void noDataWithoutEvidenceOrOtherPeriod() {
        assertThat(map(List.of(new AuditOpinionItem("-", "제60기(당기)", "대주회계법인", "적정의견", null)))
                .available()).isFalse();
        assertThat(map(List.of(new AuditOpinionItem(RCEPT_NO, "제59기(당기)", "대주회계법인", "적정의견", "2024-12-31")))
                .available()).isFalse();
        assertThat(AuditOpinionMapper.toOpinions(RCEPT_NO, FY2025, new PeriodicReportInfoPage<>(true, List.of()), NOW)
                .available()).isFalse();
    }
}
