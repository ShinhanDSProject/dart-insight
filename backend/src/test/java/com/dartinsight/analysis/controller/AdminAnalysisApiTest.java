package com.dartinsight.analysis.controller;

import static com.dartinsight.support.AdminFixtures.CORP_A;
import static com.dartinsight.support.AdminFixtures.CORP_B;
import static com.dartinsight.support.AdminFixtures.CUR;
import static com.dartinsight.support.AdminFixtures.PREV;
import static com.dartinsight.support.TestAccounts.withToken;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.AdminFixtures;
import com.dartinsight.support.TestAccounts;
import com.dartinsight.support.TestData;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** 관리자 분석 작업 목록(3.34, FS-72): GET /api/admin/analyses */
@SpringBootTest
@AutoConfigureMockMvc
class AdminAnalysisApiTest {
    private static final String PATH = "/api/admin/analyses";
    private static final String V = Analysis.CURRENT_VERSION;
    private static final String TRACE = "8f2c1a0b9d7e4c21a1b2c3d4e5f60789";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CompanyImportService companyImportService;
    @Autowired ReportRepository reportRepository;
    @Autowired Clock clock;

    private LocalDate today;
    private String admin;
    private long completed;
    private long failed;
    private long running;
    private long failedBeforeStart;

    @BeforeEach
    void setUp() throws Exception {
        clear();
        LocalDateTime now = LocalDateTime.now(clock);
        today = now.toLocalDate();
        AdminFixtures.companiesAndReports(companyImportService, reportRepository, now);
        admin = TestAccounts.signIn(mvc, "admin@example.com", null);
        TestAccounts.grantAdmin(jdbc, "admin@example.com");
        completed = AdminFixtures.analysis(jdbc, CORP_A, "COMPLETED", "DONE", "m2-1", null, null, at(10, 9),
                at(10, 9), at(10, 9).plusSeconds(48));
        failed = AdminFixtures.analysis(jdbc, CORP_B, "FAILED", "COMPARING", V, "ANALYSIS_SUMMARY_FAILED", TRACE,
                at(2, 14), at(2, 14).plusSeconds(1), at(2, 14).plusSeconds(70));
        running = AdminFixtures.analysis(jdbc, CORP_A, "RUNNING", "COMPARING", V, null, null, at(0, 1), at(0, 1),
                null);
        failedBeforeStart = AdminFixtures.analysis(jdbc, CORP_B, "FAILED", "RECEIVED", V, "DART_UNAVAILABLE", null,
                at(0, 2), null, at(0, 2));
    }

    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        TestAccounts.clearUsers(jdbc);
    }

    @Test
    @DisplayName("요청 최근 순으로 기업명·두 보고서·상태·단계·실패 사유·추적 ID·버전·걸린 시간을 돌려준다")
    void listsAnalysesNewestFirst() throws Exception {
        mvc.perform(withToken(get(PATH), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalItems").value(4))
                .andExpect(jsonPath("$.items[*].analysisId").value(contains(
                        (int) failedBeforeStart, (int) running, (int) failed, (int) completed)))
                .andExpect(jsonPath("$.items[2].corpCode").value(CORP_B))
                .andExpect(jsonPath("$.items[2].corpName").value("둘째화학"))
                .andExpect(jsonPath("$.items[2].basis").value("YOY"))
                .andExpect(jsonPath("$.items[2].current.rceptNo").value(CUR))
                .andExpect(jsonPath("$.items[2].current.reportName").value("반기보고서 (2026.06)"))
                .andExpect(jsonPath("$.items[2].previous.rceptNo").value(PREV))
                .andExpect(jsonPath("$.items[2].previous.reportName").value("반기보고서 (2025.06)"))
                .andExpect(jsonPath("$.items[2].status").value("FAILED"))
                .andExpect(jsonPath("$.items[2].step").value("COMPARING"))
                .andExpect(jsonPath("$.items[2].errorCode").value("ANALYSIS_SUMMARY_FAILED"))
                .andExpect(jsonPath("$.items[2].errorMessage").value("요약을 만들지 못했어요."))
                .andExpect(jsonPath("$.items[2].traceId").value(TRACE))
                .andExpect(jsonPath("$.items[2].analysisVersion").value(V))
                .andExpect(jsonPath("$.items[2].outdated").value(false))
                .andExpect(jsonPath("$.items[2].createdAt").value(at(2, 14).toString() + ":00"))
                .andExpect(jsonPath("$.items[2].startedAt").value(at(2, 14).plusSeconds(1).toString()))
                // 실패는 updated_at − started_at = 70 − 1
                .andExpect(jsonPath("$.items[2].durationSeconds").value(69))
                // 완료는 completed_at − started_at, 옛 버전이면 outdated
                .andExpect(jsonPath("$.items[3].durationSeconds").value(48))
                .andExpect(jsonPath("$.items[3].outdated").value(true))
                .andExpect(jsonPath("$.items[3].traceId").isEmpty())
                // 진행 중·시작 전 실패는 null
                .andExpect(jsonPath("$.items[1].durationSeconds").isEmpty())
                .andExpect(jsonPath("$.items[1].completedAt").isEmpty())
                .andExpect(jsonPath("$.items[0].durationSeconds").isEmpty())
                .andExpect(jsonPath("$.items[0].startedAt").isEmpty());
    }

    @Test
    @DisplayName("상태와 기간(오늘부터 거꾸로 days일)으로 거르고, page·size로 나눈다")
    void filtersByStatusDaysAndPages() throws Exception {
        mvc.perform(withToken(get(PATH).param("status", "FAILED"), admin))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[*].analysisId").value(contains((int) failedBeforeStart, (int) failed)));
        mvc.perform(withToken(get(PATH).param("days", "1"), admin))
                .andExpect(jsonPath("$.items[*].analysisId").value(contains((int) failedBeforeStart, (int) running)));
        mvc.perform(withToken(get(PATH).param("days", "7").param("status", "FAILED"), admin))
                .andExpect(jsonPath("$.totalItems").value(2));
        mvc.perform(withToken(get(PATH).param("days", "30").param("status", "COMPLETED"), admin))
                .andExpect(jsonPath("$.items[*].analysisId").value(contains((int) completed)));
        mvc.perform(withToken(get(PATH).param("page", "1").param("size", "3"), admin))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(3))
                .andExpect(jsonPath("$.totalItems").value(4))
                .andExpect(jsonPath("$.items[*].analysisId").value(contains((int) completed)));
    }

    @Test
    @DisplayName("검색어가 숫자면 분석 ID, 8자리면 고유번호도, 그 밖에는 기업명 부분 일치·추적 ID 일치로 찾는다")
    void searchesByIdCorpCodeCorpNameAndTraceId() throws Exception {
        mvc.perform(withToken(get(PATH).param("q", " " + running + " "), admin))
                .andExpect(jsonPath("$.items[*].analysisId").value(contains((int) running)));
        Long byIdOrCorp = jdbc.queryForObject("SELECT COUNT(*) FROM analysis WHERE corp_code = ? OR id = ?",
                Long.class, CORP_B, Long.parseLong(CORP_B));
        mvc.perform(withToken(get(PATH).param("q", CORP_B), admin))
                .andExpect(jsonPath("$.totalItems").value(byIdOrCorp.intValue()));
        mvc.perform(withToken(get(PATH).param("q", "둘째"), admin))
                .andExpect(jsonPath("$.items[*].analysisId").value(contains((int) failedBeforeStart, (int) failed)));
        mvc.perform(withToken(get(PATH).param("q", TRACE), admin))
                .andExpect(jsonPath("$.items[*].analysisId").value(contains((int) failed)));
        // 추적 ID는 전체 일치만, LIKE 특수 문자는 글자 그대로
        mvc.perform(withToken(get(PATH).param("q", TRACE.substring(0, 8) + "x"), admin))
                .andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(withToken(get(PATH).param("q", "%"), admin))
                .andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(withToken(get(PATH).param("q", "  "), admin))
                .andExpect(jsonPath("$.totalItems").value(4));
    }

    @ParameterizedTest
    @CsvSource({"status,DONE", "status,failed", "days,2", "days,abc", "page,-1", "size,0", "size,51"})
    @DisplayName("상태·기간·쪽이 정한 값이 아니면 400 COMMON_INVALID_INPUT과 errors[field]다")
    void rejectsInvalidParameters(String field, String value) throws Exception {
        mvc.perform(withToken(get(PATH).param(field, value), admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value(field));
    }

    @Test
    @DisplayName("검색어가 50자를 넘으면 400 errors[q], 로그인하지 않으면 401, 관리자가 아니면 403이다")
    void rejectsLongQueryAndNonAdmin() throws Exception {
        mvc.perform(withToken(get(PATH).param("q", "가".repeat(51)), admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("q"));
        mvc.perform(withToken(get(PATH).param("q", "가".repeat(50)), admin)).andExpect(status().isOk());
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
        String user = TestAccounts.signIn(mvc, "user@example.com", null);
        mvc.perform(withToken(get(PATH), user)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_FORBIDDEN"));
    }

    private LocalDateTime at(int daysAgo, int hour) {
        return today.minusDays(daysAgo).atTime(hour, 0);
    }
}
