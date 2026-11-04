package com.dartinsight.admin.controller;

import static com.dartinsight.support.AdminFixtures.CORP_A;
import static com.dartinsight.support.AdminFixtures.CORP_B;
import static com.dartinsight.support.TestAccounts.withToken;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

/** 관리자 회원 목록(3.34, FS-72): GET /api/admin/users. 이메일은 가린 값만 나간다. */
@SpringBootTest
@AutoConfigureMockMvc
class AdminUserApiTest {
    private static final String PATH = "/api/admin/users";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CompanyImportService companyImportService;
    @Autowired ReportRepository reportRepository;
    @Autowired Clock clock;

    private LocalDate today;
    private String admin;
    private long adminId;
    private long member;
    private long kakao;
    private long noEmail;

    @BeforeEach
    void setUp() throws Exception {
        clear();
        LocalDateTime now = LocalDateTime.now(clock);
        today = now.toLocalDate();
        AdminFixtures.companiesAndReports(companyImportService, reportRepository, now);
        admin = TestAccounts.signIn(mvc, "admin@example.com", "운영자");
        TestAccounts.grantAdmin(jdbc, "admin@example.com");
        adminId = TestAccounts.userId(jdbc, "admin@example.com");
        AdminFixtures.setCreatedAt(jdbc, adminId, at(5));

        TestAccounts.signIn(mvc, "tjdals@gmail.com", "반도체공부중");
        member = TestAccounts.userId(jdbc, "tjdals@gmail.com");
        AdminFixtures.setCreatedAt(jdbc, member, at(3));
        AdminFixtures.socialAccount(jdbc, member, "google", "other@gmail.com", at(2));
        AdminFixtures.favorite(jdbc, member, CORP_A, at(1));
        AdminFixtures.favorite(jdbc, member, CORP_B, at(1));
        AdminFixtures.post(jdbc, member, "VISIBLE", at(1));
        AdminFixtures.post(jdbc, member, "BLINDED", at(1));
        AdminFixtures.post(jdbc, member, "DELETED", at(1));

        kakao = AdminFixtures.socialUser(jdbc, "kakao", null, at(2));
        AdminFixtures.socialAccount(jdbc, kakao, "naver", "AB@Naver.com", at(1));
        jdbc.update("UPDATE app_user SET nickname = 'Chip2026' WHERE id = ?", kakao);

        noEmail = AdminFixtures.socialUser(jdbc, "google", null, at(1));
    }

    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        TestAccounts.clearUsers(jdbc);
    }

    @Test
    @DisplayName("가입 최근 순으로 닉네임·가린 이메일·로그인 방식·역할·관심 기업 수·지우지 않은 글 수를 돌려주고 전체 이메일은 넣지 않는다")
    void listsUsersWithMaskedEmail() throws Exception {
        String body = mvc.perform(withToken(get(PATH), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalItems").value(4))
                .andExpect(jsonPath("$.items[*].userId").value(contains(
                        (int) noEmail, (int) kakao, (int) member, (int) adminId)))
                .andExpect(jsonPath("$.items[2].nickname").value("반도체공부중"))
                .andExpect(jsonPath("$.items[2].maskedEmail").value("tj***@g***.com"))
                .andExpect(jsonPath("$.items[2].providers").value(contains("LOCAL", "GOOGLE")))
                .andExpect(jsonPath("$.items[2].role").value("USER"))
                .andExpect(jsonPath("$.items[2].createdAt").value(at(3).toString() + ":00"))
                .andExpect(jsonPath("$.items[2].favoriteCount").value(2))
                .andExpect(jsonPath("$.items[2].postCount").value(2))
                // 일반 가입이 없으면 이메일이 있는 소셜 계정 중 먼저 연결한 것
                .andExpect(jsonPath("$.items[1].maskedEmail").value("A***@N***.com"))
                .andExpect(jsonPath("$.items[1].providers").value(contains("KAKAO", "NAVER")))
                .andExpect(jsonPath("$.items[1].favoriteCount").value(0))
                .andExpect(jsonPath("$.items[1].postCount").value(0))
                .andExpect(jsonPath("$.items[0].maskedEmail").isEmpty())
                .andExpect(jsonPath("$.items[0].nickname").isEmpty())
                .andExpect(jsonPath("$.items[0].providers").value(contains("GOOGLE")))
                .andExpect(jsonPath("$.items[3].role").value("ADMIN"))
                .andExpect(jsonPath("$.items[3].maskedEmail").value("ad***@e***.com"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("tjdals", "other@", "Naver.com", "admin@", "example.com");
    }

    @Test
    @DisplayName("검색어는 닉네임 부분 일치(대소문자 무시) 또는 이메일 전체 일치(대소문자 무시)로 찾고, 찾은 이메일도 가린다")
    void searchesByNicknameOrEmail() throws Exception {
        mvc.perform(withToken(get(PATH).param("q", "공부"), admin))
                .andExpect(jsonPath("$.items[*].userId").value(contains((int) member)));
        mvc.perform(withToken(get(PATH).param("q", "chip"), admin))
                .andExpect(jsonPath("$.items[*].userId").value(contains((int) kakao)));
        String byEmail = mvc.perform(withToken(get(PATH).param("q", " TJDALS@Gmail.com "), admin))
                .andExpect(jsonPath("$.items[*].userId").value(contains((int) member)))
                .andExpect(jsonPath("$.items[0].maskedEmail").value("tj***@g***.com"))
                .andReturn().getResponse().getContentAsString();
        assertThat(byEmail).doesNotContain("tjdals");
        mvc.perform(withToken(get(PATH).param("q", "ab@naver.com"), admin))
                .andExpect(jsonPath("$.items[*].userId").value(contains((int) kakao)));
        mvc.perform(withToken(get(PATH).param("q", "other@gmail.com"), admin))
                .andExpect(jsonPath("$.items[*].userId").value(contains((int) member)));
        // 이메일은 일부만으로 찾지 않는다
        mvc.perform(withToken(get(PATH).param("q", "tjdals@gmail"), admin))
                .andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(withToken(get(PATH).param("q", "%"), admin))
                .andExpect(jsonPath("$.totalItems").value(0));
    }

    @Test
    @DisplayName("역할로 거르고 page·size로 나눈다")
    void filtersByRoleAndPages() throws Exception {
        mvc.perform(withToken(get(PATH).param("role", "ADMIN"), admin))
                .andExpect(jsonPath("$.items[*].userId").value(contains((int) adminId)));
        mvc.perform(withToken(get(PATH).param("role", "USER").param("q", "공부"), admin))
                .andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(withToken(get(PATH).param("page", "1").param("size", "3"), admin))
                .andExpect(jsonPath("$.totalItems").value(4))
                .andExpect(jsonPath("$.items[*].userId").value(contains((int) adminId)));
    }

    @ParameterizedTest
    @CsvSource({"role,admin", "role,OWNER", "page,-1", "size,51"})
    @DisplayName("역할·쪽이 정한 값이 아니면 400 COMMON_INVALID_INPUT과 errors[field]다")
    void rejectsInvalidParameters(String field, String value) throws Exception {
        mvc.perform(withToken(get(PATH).param(field, value), admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value(field));
    }

    @Test
    @DisplayName("검색어가 50자를 넘으면 400 errors[q], 로그인하지 않으면 401, 관리자가 아니면 403이다")
    void rejectsLongQueryAndNonAdmin() throws Exception {
        mvc.perform(withToken(get(PATH).param("q", "a".repeat(51)), admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("q"));
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
        String user = TestAccounts.signIn(mvc, "user@example.com", null);
        mvc.perform(withToken(get(PATH), user)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_FORBIDDEN"));
    }

    private LocalDateTime at(int daysAgo) {
        return today.minusDays(daysAgo).atTime(9, 0);
    }
}
