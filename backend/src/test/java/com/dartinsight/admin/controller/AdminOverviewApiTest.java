package com.dartinsight.admin.controller;

import static com.dartinsight.support.AdminFixtures.CORP_A;
import static com.dartinsight.support.AdminFixtures.CORP_B;
import static com.dartinsight.support.TestAccounts.withToken;
import static org.assertj.core.api.Assertions.assertThat;
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
import java.sql.Timestamp;
import java.time.Clock;
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

/** 관리자 개요(3.34, FS-72): GET /api/admin/overview */
@SpringBootTest
@AutoConfigureMockMvc
class AdminOverviewApiTest {
    private static final String PATH = "/api/admin/overview";
    private static final String V = Analysis.CURRENT_VERSION;

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CompanyImportService companyImportService;
    @Autowired ReportRepository reportRepository;
    @Autowired Clock clock;

    private LocalDate today;
    private String admin;

    @BeforeEach
    void setUp() throws Exception {
        clear();
        LocalDateTime now = LocalDateTime.now(clock);
        today = now.toLocalDate();
        AdminFixtures.companiesAndReports(companyImportService, reportRepository, now);
        admin = TestAccounts.signIn(mvc, "admin@example.com", "운영자");
        TestAccounts.grantAdmin(jdbc, "admin@example.com");
    }

    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        TestAccounts.clearUsers(jdbc);
    }

    @Test
    @DisplayName("기록이 없으면 수는 0, 비율·백분위·비용은 null이고 기본 기간은 7일이며 날짜별 값은 모든 날짜에 0이다")
    void returnsZerosAndNullsWhenEmpty() throws Exception {
        mvc.perform(withToken(get(PATH), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(7))
                .andExpect(jsonPath("$.from").value(today.minusDays(6).toString()))
                .andExpect(jsonPath("$.to").value(today.toString()))
                .andExpect(jsonPath("$.analyses.requested").value(0))
                .andExpect(jsonPath("$.analyses.completionRate").isEmpty())
                .andExpect(jsonPath("$.analyses.p50Seconds").isEmpty())
                .andExpect(jsonPath("$.analyses.p90Seconds").isEmpty())
                .andExpect(jsonPath("$.analyses.daily", hasSize(7)))
                .andExpect(jsonPath("$.analyses.daily[0].date").value(today.minusDays(6).toString()))
                .andExpect(jsonPath("$.analyses.daily[6].requested").value(0))
                .andExpect(jsonPath("$.analyses.topFailures", hasSize(0)))
                .andExpect(jsonPath("$.analyses.topCompanies", hasSize(0)))
                .andExpect(jsonPath("$.users.total").value(1))
                .andExpect(jsonPath("$.users.admins").value(1))
                .andExpect(jsonPath("$.users.byProvider.LOCAL").value(1))
                .andExpect(jsonPath("$.users.byProvider.GOOGLE").value(0))
                .andExpect(jsonPath("$.users.byProvider.KAKAO").value(0))
                .andExpect(jsonPath("$.users.byProvider.NAVER").value(0))
                .andExpect(jsonPath("$.watch.favorites").value(0))
                .andExpect(jsonPath("$.watch.topWatched", hasSize(0)))
                .andExpect(jsonPath("$.community.openReports").value(0))
                .andExpect(jsonPath("$.community.postsInPeriod").value(0))
                .andExpect(jsonPath("$.ai.calls").value(0))
                .andExpect(jsonPath("$.ai.failedCalls").value(0))
                .andExpect(jsonPath("$.ai.estimatedCostUsd").isEmpty())
                .andExpect(jsonPath("$.ai.unpricedCalls").value(0))
                .andExpect(jsonPath("$.planInterests.total").value(0))
                .andExpect(jsonPath("$.planInterests.byPlan.FREE").value(0))
                .andExpect(jsonPath("$.planInterests.byPlan.EMBED").value(0))
                .andExpect(jsonPath("$.planInterests.daily", hasSize(7)))
                .andExpect(jsonPath("$.planInterests.daily[6].count").value(0));
    }

    @Test
    @DisplayName("기간 안에 요청한 분석의 상태별 수·완료율·걸린 시간 백분위·옛 버전 수·실패 사유·기업 상위를 코드로 센다")
    void countsAnalysesInsidePeriod() throws Exception {
        completed(CORP_A, V, at(1, 10), 40);
        completed(CORP_A, "m2-1", at(1, 11), 100);
        completed(CORP_A, V, at(2, 9), 60);
        failed(CORP_B, "ANALYSIS_SUMMARY_FAILED", at(2, 10), at(2, 10), 30);
        failed(CORP_B, "ANALYSIS_SUMMARY_FAILED", at(0, 1), at(0, 1), 10);
        failed(CORP_A, "DART_UNAVAILABLE", at(3, 8), null, 0);
        AdminFixtures.analysis(jdbc, CORP_A, "RUNNING", "COMPARING", V, null, null, at(0, 2), at(0, 2), null);
        AdminFixtures.analysis(jdbc, CORP_B, "PENDING", "RECEIVED", V, null, null, at(0, 3), null, null);
        completed(CORP_A, V, at(10, 9), 5);

        mvc.perform(withToken(get(PATH).param("days", "7"), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analyses.requested").value(8))
                .andExpect(jsonPath("$.analyses.completed").value(3))
                .andExpect(jsonPath("$.analyses.failed").value(3))
                .andExpect(jsonPath("$.analyses.inProgress").value(2))
                // 3 ÷ (3 + 3) = 0.5
                .andExpect(jsonPath("$.analyses.completionRate").value(0.5))
                // 완료 [40, 60, 100]초: 50번째 ⌈1.5⌉ = 2번째, 90번째 ⌈2.7⌉ = 3번째
                .andExpect(jsonPath("$.analyses.p50Seconds").value(60))
                .andExpect(jsonPath("$.analyses.p90Seconds").value(100))
                .andExpect(jsonPath("$.analyses.outdated").value(1))
                .andExpect(jsonPath("$.analyses.daily[4].date").value(today.minusDays(2).toString()))
                .andExpect(jsonPath("$.analyses.daily[4].requested").value(2))
                .andExpect(jsonPath("$.analyses.daily[4].completed").value(1))
                .andExpect(jsonPath("$.analyses.daily[4].failed").value(1))
                .andExpect(jsonPath("$.analyses.daily[6].requested").value(3))
                .andExpect(jsonPath("$.analyses.daily[6].completed").value(0))
                .andExpect(jsonPath("$.analyses.daily[6].failed").value(1))
                .andExpect(jsonPath("$.analyses.daily[0].requested").value(0))
                .andExpect(jsonPath("$.analyses.topFailures", hasSize(2)))
                .andExpect(jsonPath("$.analyses.topFailures[0].errorCode").value("ANALYSIS_SUMMARY_FAILED"))
                .andExpect(jsonPath("$.analyses.topFailures[0].count").value(2))
                .andExpect(jsonPath("$.analyses.topFailures[0].lastAt")
                        .value(today.atTime(1, 0, 10).toString()))
                .andExpect(jsonPath("$.analyses.topFailures[1].errorCode").value("DART_UNAVAILABLE"))
                .andExpect(jsonPath("$.analyses.topCompanies[0].corpCode").value(CORP_A))
                .andExpect(jsonPath("$.analyses.topCompanies[0].corpName").value("예시전자"))
                .andExpect(jsonPath("$.analyses.topCompanies[0].count").value(5))
                .andExpect(jsonPath("$.analyses.topCompanies[1].corpCode").value(CORP_B))
                .andExpect(jsonPath("$.analyses.topCompanies[1].corpName").value("둘째화학"))
                .andExpect(jsonPath("$.analyses.topCompanies[1].count").value(3));

        mvc.perform(withToken(get(PATH).param("days", "30"), admin))
                .andExpect(jsonPath("$.days").value(30))
                .andExpect(jsonPath("$.analyses.daily", hasSize(30)))
                .andExpect(jsonPath("$.analyses.requested").value(9))
                .andExpect(jsonPath("$.analyses.completed").value(4));
    }

    @Test
    @DisplayName("완료 없이 실패만 있으면 완료율은 0이고 백분위는 null이다(0과 null을 구분)")
    void completionRateIsZeroNotNullWhenOnlyFailures() throws Exception {
        failed(CORP_A, "ANALYSIS_SUMMARY_FAILED", at(1, 9), at(1, 9), 5);

        mvc.perform(withToken(get(PATH), admin))
                .andExpect(jsonPath("$.analyses.completionRate").value(0.0))
                .andExpect(jsonPath("$.analyses.p50Seconds").isEmpty());
    }

    @Test
    @DisplayName("회원은 가입 방식(일반 가입 우선, 아니면 처음 연결한 소셜)으로 세고, 관심 기업·글·신고·LLM·요금제 관심을 센다")
    void countsUsersWatchCommunityAiAndPlanInterests() throws Exception {
        TestAccounts.signIn(mvc, "member@example.com", null);
        long member = TestAccounts.userId(jdbc, "member@example.com");
        AdminFixtures.setCreatedAt(jdbc, member, at(40, 9));
        AdminFixtures.socialAccount(jdbc, member, "google", "member@gmail.com", at(1, 9));
        long google = AdminFixtures.socialUser(jdbc, "google", "g@gmail.com", at(1, 9));
        long kakao = AdminFixtures.socialUser(jdbc, "kakao", null, at(50, 9));
        AdminFixtures.socialAccount(jdbc, kakao, "google", "k@gmail.com", at(5, 9));
        long naver = AdminFixtures.socialUser(jdbc, "naver", "n@naver.com", at(3, 9));

        AdminFixtures.favorite(jdbc, member, CORP_A, at(1, 9));
        AdminFixtures.favorite(jdbc, member, CORP_B, at(1, 9));
        AdminFixtures.favorite(jdbc, google, CORP_A, at(1, 9));
        AdminFixtures.favorite(jdbc, naver, CORP_A, at(20, 9));

        AdminFixtures.post(jdbc, member, "VISIBLE", at(1, 9));
        AdminFixtures.post(jdbc, member, "DELETED", at(2, 9));
        AdminFixtures.post(jdbc, google, "VISIBLE", at(20, 9));
        List<Long> posts = jdbc.queryForList("SELECT id FROM community_post ORDER BY id", Long.class);
        report(posts.get(0), "OPEN");
        report(posts.get(2), "KEPT");

        long analysisId = completed(CORP_A, V, at(1, 9), 10);
        // gpt-6.1-sol(입력 $2, 출력 $10 / 1M): (10000 × 2 + 1000 × 10 + 5000 × 2 + 500 × 10) ÷ 1,000,000 = 0.045
        AdminFixtures.llmCall(jdbc, analysisId, "openai", "gpt-6.1-sol", "OK", at(1, 9), 10000, 1000);
        AdminFixtures.llmCall(jdbc, analysisId, "openai", "gpt-6.1-sol", "INVALID_OUTPUT", at(2, 9), 5000, 500);
        AdminFixtures.llmCall(jdbc, analysisId, "fake", "fake-model", "OK", at(0, 1), 100, 10);
        AdminFixtures.llmCall(jdbc, analysisId, "openai", "gpt-6.1-sol", "OK", at(10, 9), 99999, 99999);

        AdminFixtures.planInterest(jdbc, "PRO", member, at(1, 9));
        AdminFixtures.planInterest(jdbc, "PRO", null, at(1, 10));
        AdminFixtures.planInterest(jdbc, "TEAM", null, at(0, 1));
        AdminFixtures.planInterest(jdbc, "FREE", null, at(10, 9));

        String body = mvc.perform(withToken(get(PATH), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users.total").value(5))
                .andExpect(jsonPath("$.users.admins").value(1))
                .andExpect(jsonPath("$.users.newInPeriod").value(3))
                .andExpect(jsonPath("$.users.byProvider.LOCAL").value(2))
                .andExpect(jsonPath("$.users.byProvider.GOOGLE").value(1))
                .andExpect(jsonPath("$.users.byProvider.KAKAO").value(1))
                .andExpect(jsonPath("$.users.byProvider.NAVER").value(1))
                .andExpect(jsonPath("$.users.daily[3].signups").value(1))
                .andExpect(jsonPath("$.users.daily[5].signups").value(1))
                .andExpect(jsonPath("$.users.daily[6].signups").value(1))
                .andExpect(jsonPath("$.watch.favorites").value(4))
                .andExpect(jsonPath("$.watch.companies").value(2))
                .andExpect(jsonPath("$.watch.topWatched[0].corpCode").value(CORP_A))
                .andExpect(jsonPath("$.watch.topWatched[0].corpName").value("예시전자"))
                .andExpect(jsonPath("$.watch.topWatched[0].count").value(3))
                .andExpect(jsonPath("$.watch.topWatched[1].count").value(1))
                .andExpect(jsonPath("$.community.openReports").value(1))
                .andExpect(jsonPath("$.community.postsInPeriod").value(2))
                .andExpect(jsonPath("$.ai.calls").value(3))
                .andExpect(jsonPath("$.ai.failedCalls").value(1))
                .andExpect(jsonPath("$.ai.estimatedCostUsd").value(0.045))
                .andExpect(jsonPath("$.ai.unpricedCalls").value(1))
                .andExpect(jsonPath("$.planInterests.total").value(3))
                .andExpect(jsonPath("$.planInterests.signedIn").value(1))
                .andExpect(jsonPath("$.planInterests.byPlan.FREE").value(0))
                .andExpect(jsonPath("$.planInterests.byPlan.PRO").value(2))
                .andExpect(jsonPath("$.planInterests.byPlan.TEAM").value(1))
                .andExpect(jsonPath("$.planInterests.byPlan.EMBED").value(0))
                .andExpect(jsonPath("$.planInterests.daily[5].count").value(2))
                .andExpect(jsonPath("$.planInterests.daily[6].count").value(1))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("example.com", "gmail.com", "naver.com", "운영자");

        // 처리할 신고 수는 관리자 신고 목록(queue=todo)의 totalItems와 같다
        mvc.perform(withToken(get("/api/admin/reports").param("queue", "todo"), admin))
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    @DisplayName("가격이 설정된 모델의 호출이 없으면 추정 비용은 null이고 가격 없는 호출 수만 센다")
    void costIsNullWithoutPricedCalls() throws Exception {
        long analysisId = completed(CORP_A, V, at(1, 9), 10);
        AdminFixtures.llmCall(jdbc, analysisId, "fake", "fake-model", "ERROR", at(1, 9), 100, 10);

        mvc.perform(withToken(get(PATH), admin))
                .andExpect(jsonPath("$.ai.calls").value(1))
                .andExpect(jsonPath("$.ai.failedCalls").value(1))
                .andExpect(jsonPath("$.ai.estimatedCostUsd").isEmpty())
                .andExpect(jsonPath("$.ai.unpricedCalls").value(1));
    }

    @Test
    @DisplayName("days가 7·30이 아니면 400 errors[days], 로그인하지 않으면 401, 관리자가 아니면 403이다")
    void validatesDaysAndRequiresAdmin() throws Exception {
        for (String days : List.of("1", "14", "31", "abc")) {
            mvc.perform(withToken(get(PATH).param("days", days), admin))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                    .andExpect(jsonPath("$.errors[0].field").value("days"));
        }
        mvc.perform(get(PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
        String user = TestAccounts.signIn(mvc, "user@example.com", null);
        mvc.perform(withToken(get(PATH), user))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_FORBIDDEN"));
    }

    /** 오늘부터 daysAgo일 전 hour시 */
    private LocalDateTime at(int daysAgo, int hour) {
        return today.minusDays(daysAgo).atTime(hour, 0);
    }

    private long completed(String corpCode, String version, LocalDateTime createdAt, int seconds) {
        return AdminFixtures.analysis(jdbc, corpCode, "COMPLETED", "DONE", version, null, null, createdAt, createdAt,
                createdAt.plusSeconds(seconds));
    }

    private void failed(String corpCode, String errorCode, LocalDateTime createdAt, LocalDateTime startedAt,
            int seconds) {
        LocalDateTime base = startedAt == null ? createdAt : startedAt;
        AdminFixtures.analysis(jdbc, corpCode, "FAILED", "COMPARING", V, errorCode, null, createdAt, startedAt,
                base.plusSeconds(seconds));
    }

    private void report(long postId, String status) {
        Timestamp now = Timestamp.valueOf(LocalDateTime.now(clock));
        jdbc.update("INSERT INTO community_report (target_type, target_id, post_id, status, report_count, "
                + "last_reported_at, created_at, updated_at) VALUES ('POST', ?, ?, ?, 1, ?, ?, ?)", postId, postId,
                status, now, now, now);
    }
}
