package com.dartinsight.planinterest.controller;

import static com.dartinsight.support.TestAccounts.withToken;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.support.TestAccounts;
import com.dartinsight.support.TestData;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 요금제 '관심 있어요'(3.34, FS-73): POST /api/plan-interests. 로그인 없이 쓰고, 유효한 토큰이면 회원 ID를 남긴다. */
@SpringBootTest
@AutoConfigureMockMvc
class PlanInterestApiTest {
    private static final String PATH = "/api/plan-interests";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        TestAccounts.clearUsers(jdbc);
    }

    @Test
    @DisplayName("로그인하지 않아도 204로 남기고, source가 없으면 pricing이며 회원 ID는 null이다")
    void recordsWithoutLogin() throws Exception {
        mvc.perform(json(post(PATH), "{\"plan\":\"PRO\"}")).andExpect(status().isNoContent());

        Map<String, Object> row = jdbc.queryForMap("SELECT plan, source, user_id, created_at FROM plan_interest");
        assertThat(row.get("plan")).isEqualTo("PRO");
        assertThat(row.get("source")).isEqualTo("pricing");
        assertThat(row.get("user_id")).isNull();
        assertThat(row.get("created_at")).isNotNull();
    }

    @Test
    @DisplayName("유효한 Access Token이 있으면 그 회원 ID를 함께 남기고, 같은 사람이 다시 눌러도 그대로 센다")
    void recordsSignedInUserAndCountsRepeats() throws Exception {
        String token = TestAccounts.signIn(mvc, "plan@example.com", null);
        long userId = TestAccounts.userId(jdbc, "plan@example.com");

        mvc.perform(json(withToken(post(PATH), token), "{\"plan\":\"TEAM\",\"source\":\"pricing-credits\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(json(withToken(post(PATH), token), "{\"plan\":\"TEAM\",\"source\":\"pricing-credits\"}"))
                .andExpect(status().isNoContent());

        List<Map<String, Object>> rows = jdbc.queryForList("SELECT plan, source, user_id FROM plan_interest");
        assertThat(rows).hasSize(2).allSatisfy(row -> {
            assertThat(row.get("plan")).isEqualTo("TEAM");
            assertThat(row.get("source")).isEqualTo("pricing-credits");
            assertThat(((Number) row.get("user_id")).longValue()).isEqualTo(userId);
        });
    }

    @Test
    @DisplayName("잘못된 토큰은 401이 아니라 무시하고 로그인 없이 남긴다")
    void ignoresInvalidToken() throws Exception {
        mvc.perform(json(withToken(post(PATH), "not-a-jwt"), "{\"plan\":\"FREE\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(json(post(PATH).header("Authorization", "Bearer "), "{\"plan\":\"EMBED\"}"))
                .andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM plan_interest WHERE user_id IS NULL", Integer.class))
                .isEqualTo(2);
    }

    @Test
    @DisplayName("토큰은 유효하지만 회원 행이 없으면(탈퇴) 로그인 없이 남긴다")
    void storesNullForDeletedUser() throws Exception {
        String token = TestAccounts.signIn(mvc, "gone@example.com", null);
        TestAccounts.clearUsers(jdbc);

        mvc.perform(json(withToken(post(PATH), token), "{\"plan\":\"PRO\"}")).andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM plan_interest WHERE user_id IS NULL", Integer.class))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("다른 API는 여전히 잘못된 토큰을 401 AUTH_UNAUTHORIZED로 막는다")
    void otherEndpointsStillRejectInvalidToken() throws Exception {
        mvc.perform(json(withToken(post("/api/companies/00000001/posts"), "not-a-jwt"), "{\"body\":\"본문\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"plan\":\"pro\"}", "{\"plan\":\"GOLD\"}", "{\"plan\":1}"})
    @DisplayName("plan이 네 값이 아니면 400 errors[plan]이고 남기지 않는다")
    void rejectsInvalidPlan(String body) throws Exception {
        mvc.perform(json(post(PATH), body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("plan"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM plan_interest", Integer.class)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"\"", "\"Pricing\"", "\"pricing page\"", "\"pricing_credits\"", "1",
            "\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\""})
    @DisplayName("source가 영문 소문자·숫자·- 1~40자가 아니면 400 errors[source]다")
    void rejectsInvalidSource(String source) throws Exception {
        mvc.perform(json(post(PATH), "{\"plan\":\"PRO\",\"source\":" + source + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("source"));
        mvc.perform(json(post(PATH), "{\"plan\":\"PRO\",\"source\":\"" + "a".repeat(40) + "\"}"))
                .andExpect(status().isNoContent());
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }
}
