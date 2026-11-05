package com.dartinsight.llmquota.controller;

import static com.dartinsight.support.TestAccounts.withToken;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.support.TestAccounts;
import com.dartinsight.support.TestData;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 질문·에이전트 채팅의 하루 한도(ADR-0054). 없는 분석 ID로 불러 LLM 없이 한도만 본다(한도 안이면 404, 넘으면 429).
 * MockMvc 요청은 루프백(127.0.0.1)에서 오므로 X-Forwarded-For로 클라이언트를 나눈다.
 */
@SpringBootTest(properties = {
        "app.llm-quota.enabled=true",
        "app.llm-quota.anonymous-per-day=2",
        "app.llm-quota.member-per-day=3",
        "app.llm-quota.total-per-day=10"})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class LlmQuotaApiTest {

    private static final String QUESTIONS = "/api/analyses/987654/questions";
    private static final String CHAT = "/api/analyses/987654/chat-messages";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        TestAccounts.clearUsers(jdbc);
    }

    @Test
    @DisplayName("로그인하지 않은 IP는 하루 한도까지 통과하고, 넘으면 LLM 전에 429와 로그인 안내·Retry-After를 준다")
    void blocksAnonymousCallerAfterDailyLimit() throws Exception {
        mvc.perform(ask(QUESTIONS, "1.1.1.1")).andExpect(status().isNotFound());
        mvc.perform(ask(CHAT, "1.1.1.1")).andExpect(status().isNotFound());

        mvc.perform(ask(QUESTIONS, "1.1.1.1"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("AI_QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.message").value(Matchers.containsString("로그인하면 더 쓸 수 있어요")))
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andExpect(header().string("Retry-After", Matchers.matchesPattern("[1-9][0-9]*")));
        // 다른 IP는 따로 센다
        mvc.perform(ask(QUESTIONS, "2.2.2.2")).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("회원은 IP와 상관없이 회원 ID로 세고 회원 한도를 쓴다")
    void countsMembersByUserId() throws Exception {
        String token = TestAccounts.signIn(mvc, "quota@example.com", null);
        for (String ip : new String[] {"3.3.3.1", "3.3.3.2", "3.3.3.3"}) {
            mvc.perform(withToken(ask(QUESTIONS, ip), token)).andExpect(status().isNotFound());
        }
        mvc.perform(withToken(ask(QUESTIONS, "3.3.3.4"), token))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(Matchers.containsString("3회를 다 썼어요")));
    }

    @Test
    @DisplayName("서비스 전체 한도를 넘으면 처음 오는 IP도 429다")
    void blocksEveryoneAfterTotalLimit() throws Exception {
        for (int i = 0; i < 5; i++) {
            mvc.perform(ask(QUESTIONS, "4.4.4." + i)).andExpect(status().isNotFound());
            mvc.perform(ask(QUESTIONS, "4.4.4." + i)).andExpect(status().isNotFound());
        }
        mvc.perform(ask(QUESTIONS, "5.5.5.5"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(Matchers.containsString("서비스 전체")));
    }

    @Test
    @DisplayName("질문 목록 조회(GET)는 세지 않는다")
    void doesNotCountReads() throws Exception {
        for (int i = 0; i < 4; i++) {
            mvc.perform(get(QUESTIONS).header("X-Forwarded-For", "6.6.6.6")).andExpect(status().isNotFound());
        }
        mvc.perform(ask(QUESTIONS, "6.6.6.6")).andExpect(status().isNotFound());
    }

    private static MockHttpServletRequestBuilder ask(String path, String clientIp) {
        String body = path.endsWith("chat-messages") ? "{\"message\":\"매출이 왜 늘었나요\"}" : "{\"question\":\"매출이 왜 늘었나요\"}";
        return post(path).header("X-Forwarded-For", clientIp).contentType(MediaType.APPLICATION_JSON).content(body);
    }
}
