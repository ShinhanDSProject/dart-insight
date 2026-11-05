package com.dartinsight.llmquota.controller;

import static com.dartinsight.dart.client.FinancialJson.account;
import static com.dartinsight.support.TestAccounts.withToken;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.client.FakeOpenDartServer;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.client.FinancialJson;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestAccounts;
import com.dartinsight.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 사용자가 요청한 새 분석의 하루 한도(ADR-0056). 비로그인 한도를 0으로 두어, 새로 만들려 하면 429이고
 * 이미 있는 분석을 다시 쓰거나 비교할 수 없는 쌍(422)은 세지 않음을 본다.
 */
@SpringBootTest(properties = {
        "app.llm-quota.enabled=true",
        "app.llm-quota.analysis-anonymous-per-day=0",
        "app.llm-quota.analysis-member-per-day=1",
        "app.llm-quota.analysis-total-per-day=100"})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class AnalysisQuotaApiTest {

    private static final FakeOpenDartServer SERVER = startServer();
    private static final String PATH = "/api/fnlttSinglAcntAll.json";
    private static final String CORP = "00000001";
    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    @DynamicPropertySource
    static void openDart(DynamicPropertyRegistry registry) {
        registry.add("app.opendart.base-url", SERVER::baseUrl);
        registry.add("app.opendart.read-timeout", () -> "2s");
    }

    private static FakeOpenDartServer startServer() {
        try {
            return new FakeOpenDartServer();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CompanyImportService companyImportService;
    @Autowired ReportRepository reportRepository;
    @Autowired AnalysisRepository analysisRepository;

    @BeforeEach
    void setUp() {
        clear();
        companyImportService.save(List.of(new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        saveReport(CUR, 2026);
        saveReport(PREV, 2025);
        SERVER.on(PATH, statementOf(CUR, "1153", "40", "70"), statementOf(PREV, "1000", "30", "55"));
    }

    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        TestAccounts.clearUsers(jdbc);
    }

    @Test
    @DisplayName("새로 만들어야 하는데 한도를 넘으면 분석을 만들지 않고 429와 Retry-After를 준다")
    void blocksNewAnalysisOverLimit() throws Exception {
        mvc.perform(request(CUR, PREV, "7.7.7.7"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("AI_QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.message").value(Matchers.containsString("새 분석")))
                .andExpect(jsonPath("$.message").value(Matchers.containsString("로그인하면 더 쓸 수 있어요")))
                .andExpect(header().string("Retry-After", Matchers.matchesPattern("[1-9][0-9]*")));
        assertThat(analysisRepository.count()).isZero();
    }

    @Test
    @DisplayName("회원이 만든 분석을 다시 쓰는 요청은 세지 않아, 비로그인 한도가 0이어도 막히지 않는다")
    void reuseIsNotCounted() throws Exception {
        String token = TestAccounts.signIn(mvc, "analysis-quota@example.com", null);
        String body = mvc.perform(withToken(request(CUR, PREV, "8.8.8.8"), token))
                .andExpect(jsonPath("$.reused").value(false))
                .andReturn().getResponse().getContentAsString();
        // 테스트에는 AI 서버가 없어 문장 비교가 실패로 끝나고, 그런 결과는 다시 쓰지 않으므로 비교를 마친 것으로 둔다
        long analysisId = ((Number) JsonPath.read(body, "$.analysisId")).longValue();
        jdbc.update("UPDATE analysis SET text_status = 'COMPLETED', text_message = NULL WHERE id = ?", analysisId);

        mvc.perform(request(CUR, PREV, "9.9.9.9"))
                .andExpect(jsonPath("$.reused").value(true));
        assertThat(analysisRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("비교할 수 없는 쌍은 세기 전에 422로 끝난다")
    void notComparableIsRejectedBeforeCounting() throws Exception {
        // 목록 받은 시각보다 lastSeenAt이 앞서면 정정으로 대체된 보고서라 비교할 수 없다
        jdbc.update("UPDATE company SET reports_fetched_at = ? WHERE corp_code = ?", NOW, CORP);
        jdbc.update("UPDATE report SET last_seen_at = ? WHERE rcept_no = ?", NOW.minusDays(1), PREV);

        mvc.perform(request(CUR, PREV, "7.7.7.8"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_COMPARABLE"));
    }

    private void saveReport(String rceptNo, int year) {
        reportRepository.save(Report.create(rceptNo, CORP, "반기보고서 (" + year + ".06)",
                new ParsedReportName(ReportType.HALF, year, LocalDate.of(year, 6, 30), Correction.ORIGINAL),
                LocalDate.of(year, 8, 14), null, "예시전자", NOW));
    }

    private static Response statementOf(String rceptNo, String assets, String revenueQuarter, String revenueTotal) {
        return Response.json(FinancialJson.ok(
                account(rceptNo, "BS", "ifrs-full_Assets", "자산총계", 1, assets),
                account(rceptNo, "IS", "ifrs-full_Revenue", "매출액", 1, revenueQuarter, revenueTotal)));
    }

    private static MockHttpServletRequestBuilder request(String current, String previous, String clientIp) {
        return post("/api/analyses").header("X-Forwarded-For", clientIp).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"corpCode":"%s","currentRceptNo":"%s","previousRceptNo":"%s","basis":"YOY"}
                        """.formatted(CORP, current, previous));
    }
}
