package com.dartinsight.stats.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.repository.TextChangeStore;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.AdminFixtures;
import com.dartinsight.support.TestData;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ServiceStatsApiTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 10, 9, 0);

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CompanyImportService companies;
    @Autowired ReportRepository reports;
    @Autowired TextChangeStore textChanges;

    @BeforeEach
    void setUp() {
        TestData.clearAll(jdbc);
        // 상장사 둘(CORP_A·CORP_B)과 비상장사 하나
        AdminFixtures.companiesAndReports(companies, reports, NOW);
        companies.save(List.of(new CorpCodeEntry("00000003", "비상장상사", null, null, LocalDate.of(2026, 1, 1))));
    }

    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
    }

    @Test
    @DisplayName("로그인 없이 상장사·완료 분석·완료 분석의 문장 변화 수를 주고, 10분 안에는 다시 세지 않는다")
    void countsWithoutLoginAndCachesForTenMinutes() throws Exception {
        long done = analysis("COMPLETED");
        long failed = analysis("FAILED");
        textChanges.saveAll(done, List.of(change(1), change(2)));
        textChanges.saveAll(failed, List.of(change(1)));

        mvc.perform(get("/api/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.listedCompanies").value(2))
                .andExpect(jsonPath("$.completedAnalyses").value(1))
                .andExpect(jsonPath("$.textChanges").value(2))
                .andExpect(jsonPath("$.countedAt").isString());

        analysis("COMPLETED");
        mvc.perform(get("/api/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completedAnalyses").value(1));
    }

    private long analysis(String status) {
        return AdminFixtures.analysis(jdbc, AdminFixtures.CORP_A, status, "DONE", "m2-9", null, "trace", NOW, NOW,
                NOW);
    }

    private static TextChangeRow change(int block) {
        return new TextChangeRow(TextChangeRow.MODIFIED, "PARAGRAPH", false, "MATCHED", "1. 사업의 개요",
                "II. 사업의 내용 > 1. 사업의 개요", new Side(AdminFixtures.PREV, 2, block, "이전 문단입니다."),
                new Side(AdminFixtures.CUR, 2, block, "현재 문단입니다."), new BigDecimal("0.7000"), null);
    }
}
