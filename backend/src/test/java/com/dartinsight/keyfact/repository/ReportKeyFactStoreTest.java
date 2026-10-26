package com.dartinsight.keyfact.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.keyfact.domain.Dividend;
import com.dartinsight.keyfact.domain.KeyFactKind;
import com.dartinsight.keyfact.domain.KeyFactSection;
import com.dartinsight.keyfact.domain.KeyFactStatus;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class ReportKeyFactStoreTest {

    private static final String RCEPT_NO = "20260814000001";

    @Autowired
    private ReportKeyFactStore store;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbcTemplate);
        companyImportService.save(List.of(
                new CorpCodeEntry("00000001", "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        reportRepository.save(Report.create(RCEPT_NO, "00000001", "반기보고서 (2026.06)",
                new ReportNameParser.ParsedReportName(ReportType.HALF, 2026, LocalDate.of(2026, 6, 30),
                        Correction.ORIGINAL),
                LocalDate.of(2026, 8, 14), null, "예시전자", LocalDateTime.of(2026, 10, 26, 9, 0)));
    }

    @Test
    @DisplayName("저장한 행 목록을 같은 모양으로 읽고, 다시 저장하면 한 행을 바꾼다")
    void savesAndReplacesRowsForReportAndKind() {
        LocalDateTime first = LocalDateTime.of(2026, 10, 26, 9, 0);
        store.save(KeyFactKind.DIVIDENDS, KeyFactSection.empty(RCEPT_NO, KeyFactStatus.NO_DATA), first);

        assertThat(store.find(RCEPT_NO, KeyFactKind.DIVIDENDS, Dividend.class)).hasValueSatisfying(saved -> {
            assertThat(saved.section().status()).isEqualTo(KeyFactStatus.NO_DATA);
            assertThat(saved.section().rows()).isEmpty();
            assertThat(saved.fetchedAt()).isEqualTo(first);
        });

        LocalDateTime second = first.plusDays(1);
        Dividend row = new Dividend("주당 현금배당금(원)", "보통주", "746", "1,668", null);
        store.save(KeyFactKind.DIVIDENDS, new KeyFactSection<>(RCEPT_NO, null, KeyFactStatus.AVAILABLE,
                LocalDate.of(2026, 6, 30), List.of(row)), second);

        assertThat(store.find(RCEPT_NO, KeyFactKind.DIVIDENDS, Dividend.class)).hasValueSatisfying(saved -> {
            assertThat(saved.section().status()).isEqualTo(KeyFactStatus.AVAILABLE);
            assertThat(saved.section().settlementDate()).isEqualTo(LocalDate.of(2026, 6, 30));
            assertThat(saved.section().rows()).containsExactly(row);
            assertThat(saved.fetchedAt()).isEqualTo(second);
        });
        assertThat(store.find(RCEPT_NO, KeyFactKind.EXECUTIVES, Dividend.class)).isEmpty();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM report_key_fact", Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("값을 받은 정정 공시의 접수번호를 함께 저장하고 읽는다")
    void savesSourceRceptNo() {
        Dividend row = new Dividend("주당 현금배당금(원)", "보통주", "746", "1,668", null);
        store.save(KeyFactKind.DIVIDENDS, new KeyFactSection<>(RCEPT_NO, "20260901000002", KeyFactStatus.AVAILABLE,
                LocalDate.of(2026, 6, 30), List.of(row)), LocalDateTime.of(2026, 10, 26, 9, 0));

        assertThat(store.find(RCEPT_NO, KeyFactKind.DIVIDENDS, Dividend.class)).hasValueSatisfying(saved ->
                assertThat(saved.section().sourceRceptNo()).isEqualTo("20260901000002"));
    }
}
