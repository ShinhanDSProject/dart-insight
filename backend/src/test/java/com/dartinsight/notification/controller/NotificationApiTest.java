package com.dartinsight.notification.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextComparison;
import com.dartinsight.analysis.domain.TextStatus;
import com.dartinsight.analysis.repository.AnalysisRepository;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.favorite.domain.FavoriteReportFound;
import com.dartinsight.notification.domain.WatchedReport;
import com.dartinsight.notification.repository.WatchedReportRepository;
import com.dartinsight.notification.service.NotificationService;
import com.dartinsight.report.domain.Correction;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportNameParser.ParsedReportName;
import com.dartinsight.report.domain.ReportType;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.support.TestData;
import com.jayway.jsonpath.JsonPath;
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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** 분석 완료 알림(6.4, #38, ADR-0031): 결과가 저장된 뒤에만, 즐겨찾기한 회원에게 한 번, 읽음 표시 */
@SpringBootTest
@AutoConfigureMockMvc
class NotificationApiTest {

    private static final String PASSWORD = "Sample!password";
    private static final String CORP = "00000001";
    private static final String Q3_2025 = "20251114000001";
    private static final String Q3_2026 = "20261114000001";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private CompanyImportService companyImportService;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private AnalysisResultService resultService;

    @Autowired
    private WatchedReportRepository watchedReportRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private ApplicationEventPublisher events;

    @Autowired
    private Clock clock;

    private String member;
    private String other;
    private String stranger;

    @BeforeEach
    void setUp() throws Exception {
        clear();
        LocalDateTime now = LocalDateTime.now(clock);
        companyImportService.save(List.of(new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        report(Q3_2025, 2025, now);
        report(Q3_2026, 2026, now);
        // 방금 목록을 받은 것으로 둬 OpenDART를 부르지 않게 한다
        Company company = companyRepository.findByCorpCode(CORP).orElseThrow();
        company.markReportsFetched(now);
        companyRepository.save(company);

        member = login("member@example.com");
        other = login("other@example.com");
        stranger = login("stranger@example.com");
        for (String token : List.of(member, other)) {
            mvc.perform(put("/api/favorite-companies/" + CORP).header("Authorization", bearer(token)))
                    .andExpect(status().isOk());
        }
    }

    // 회원 표를 지우는 다른 테스트가 외래 키에 걸리지 않게 끝날 때도 지운다
    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM social_account");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
    }

    @Test
    @DisplayName("지켜보는 보고서의 전년 동기 분석이 완료되면 즐겨찾기한 회원에게만 알림을 한 번 만든다")
    void notifiesFavoritingMembersOnceAfterCompletion() throws Exception {
        watchedReportRepository.save(WatchedReport.create(Q3_2026, LocalDateTime.now(clock)));
        long analysisId = completedAnalysis();

        mvc.perform(get("/api/notifications").header("Authorization", bearer(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].analysisId").value(analysisId))
                .andExpect(jsonPath("$.items[0].corpCode").value(CORP))
                .andExpect(jsonPath("$.items[0].corpName").value("예시전자"))
                .andExpect(jsonPath("$.items[0].basis").value("YOY"))
                .andExpect(jsonPath("$.items[0].previous.rceptNo").value(Q3_2025))
                .andExpect(jsonPath("$.items[0].current.rceptNo").value(Q3_2026))
                .andExpect(jsonPath("$.items[0].current.reportName").value("분기보고서 (2026.09)"))
                .andExpect(jsonPath("$.items[0].current.periodEnd").value("2026-09-30"))
                .andExpect(jsonPath("$.items[0].readAt").value(nullValue()));
        mvc.perform(get("/api/notifications").header("Authorization", bearer(other)))
                .andExpect(jsonPath("$.unreadCount").value(1));
        mvc.perform(get("/api/notifications").header("Authorization", bearer(stranger)))
                .andExpect(jsonPath("$.unreadCount").value(0))
                .andExpect(jsonPath("$.items.length()").value(0));

        // 같은 완료가 다시 들어와도(재시도·중복 이벤트) 알림은 그대로다
        notificationService.notifyIfWatched(analysisRepository.findById(analysisId).orElseThrow());
        assertThat(count()).isEqualTo(2);
    }

    @Test
    @DisplayName("지켜보지 않는 보고서의 분석과 끝나지 않은 분석에는 알림을 만들지 않는다")
    void doesNotNotifyUnwatchedOrUnfinishedAnalyses() {
        completedAnalysis();
        assertThat(count()).isZero();

        watchedReportRepository.save(WatchedReport.create(Q3_2026, LocalDateTime.now(clock)));
        Analysis running = Analysis.request(CORP, Q3_2026, Q3_2025, ComparisonBasis.YOY, null, LocalDateTime.now(clock));
        running.start(LocalDateTime.now(clock));
        notificationService.notifyIfWatched(analysisRepository.save(running));
        assertThat(count()).isZero();
    }

    @Test
    @DisplayName("새 보고서를 찾으면 전년 동기 분석을 요청하고, 이미 완료된 분석이면 바로 알린다")
    void foundReportReusesCompletedAnalysisAndNotifies() {
        long analysisId = completedAnalysis();
        assertThat(count()).isZero();

        events.publishEvent(new FavoriteReportFound(CORP, Q3_2026));

        assertThat(watchedReportRepository.existsByRceptNo(Q3_2026)).isTrue();
        assertThat(analysisRepository.count()).isEqualTo(1);
        assertThat(jdbc.queryForList("SELECT analysis_id FROM notification", Long.class))
                .containsOnly(analysisId).hasSize(2);
    }

    @Test
    @DisplayName("전년 동기 보고서가 없으면 자동 분석하지 않는다")
    void skipsWithoutPreviousYearReport() {
        events.publishEvent(new FavoriteReportFound(CORP, Q3_2025));

        assertThat(watchedReportRepository.existsByRceptNo(Q3_2025)).isFalse();
        assertThat(analysisRepository.count()).isZero();
    }

    @Test
    @DisplayName("읽음 표시·해제는 자기 알림만 바꾸고, 다른 회원의 알림은 404다")
    void marksReadAndUnreadOnlyOwnNotification() throws Exception {
        watchedReportRepository.save(WatchedReport.create(Q3_2026, LocalDateTime.now(clock)));
        completedAnalysis();
        long id = notificationId(member);

        mvc.perform(put("/api/notifications/{id}/read", id).header("Authorization", bearer(member)))
                .andExpect(status().isNoContent());
        String readAt = JsonPath.read(mvc.perform(get("/api/notifications").header("Authorization", bearer(member)))
                .andExpect(jsonPath("$.unreadCount").value(0))
                .andReturn().getResponse().getContentAsString(), "$.items[0].readAt");
        assertThat(readAt).isNotNull();
        // 다시 읽어도 처음 읽은 시각을 둔다
        mvc.perform(put("/api/notifications/{id}/read", id).header("Authorization", bearer(member)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications").header("Authorization", bearer(member)))
                .andExpect(jsonPath("$.items[0].readAt").value(readAt));

        mvc.perform(delete("/api/notifications/{id}/read", id).header("Authorization", bearer(member)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications").header("Authorization", bearer(member)))
                .andExpect(jsonPath("$.unreadCount").value(1))
                .andExpect(jsonPath("$.items[0].readAt").value(nullValue()));

        mvc.perform(put("/api/notifications/{id}/read", id).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOTIFICATION_NOT_FOUND"));
        mvc.perform(get("/api/notifications").header("Authorization", bearer(member)))
                .andExpect(jsonPath("$.unreadCount").value(1));
    }

    @Test
    @DisplayName("로그인하지 않으면 401이고, limit이 범위 밖이면 400이다")
    void requiresLoginAndValidLimit() throws Exception {
        mvc.perform(get("/api/notifications"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
        mvc.perform(put("/api/notifications/1/read")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/notifications").param("limit", "0").header("Authorization", bearer(member)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("limit"));
        mvc.perform(get("/api/notifications").param("limit", "51").header("Authorization", bearer(member)))
                .andExpect(status().isBadRequest());
    }

    private void report(String rceptNo, int year, LocalDateTime now) {
        reportRepository.save(Report.create(rceptNo, CORP, "분기보고서 (" + year + ".09)",
                new ParsedReportName(ReportType.Q3, year, LocalDate.of(year, 9, 30), Correction.ORIGINAL),
                LocalDate.of(year, 11, 14), null, "예시전자", now));
    }

    /** 결과를 저장하고 완료한 전년 동기 분석. 완료 이벤트가 커밋 뒤에 알림을 만든다 */
    private long completedAnalysis() {
        LocalDateTime now = LocalDateTime.now(clock);
        Analysis analysis = Analysis.request(CORP, Q3_2026, Q3_2025, ComparisonBasis.YOY, null, now);
        analysis.start(now);
        long id = analysisRepository.save(analysis).getId();
        resultService.saveAndComplete(id, List.of(), new TextComparison(TextStatus.COMPLETED, null, List.of()));
        return id;
    }

    private long count() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM notification", Long.class);
    }

    private long notificationId(String token) throws Exception {
        String body = mvc.perform(get("/api/notifications").header("Authorization", bearer(token)))
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.items[0].notificationId")).longValue();
    }

    private String login(String email) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        String response = mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
