package com.dartinsight.user.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class RegistrationApiTest {
    // 모든 입력은 테스트 전용 가짜 정보다.
    private static final String PASSWORD = "Sample!password";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;

    @BeforeEach
    void cleanUsers() {
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
    }

    @Test
    void registersWithoutAuthenticationAndDoesNotLogIn(CapturedOutput output) throws Exception {
        var response = signup("  Member@Example.COM  ", PASSWORD)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").isNumber())
                .andExpect(jsonPath("$.email").value("member@example.com"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(header().string("X-Trace-Id", "registration-test"))
                .andReturn().getResponse().getContentAsString();
        String hash = jdbc.queryForObject("SELECT password_hash FROM local_credential", String.class);
        assertThat(hash).startsWith("{pbkdf2-v1}").isNotEqualTo(PASSWORD);
        assertThat(encoder.matches(PASSWORD, hash)).isTrue();
        assertThat(jdbc.queryForObject("SELECT email_verified FROM local_credential", Boolean.class)).isFalse();
        assertThat(response).doesNotContain(PASSWORD, hash);
        assertThat(output.getAll()).doesNotContain(PASSWORD, hash);
    }

    @Test
    void rejectsCanonicalDuplicateAndKeepsOneMember() throws Exception {
        signup("member@example.com", PASSWORD).andExpect(status().isCreated());
        signup(" MEMBER@EXAMPLE.COM ", PASSWORD)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMON_EMAIL_ALREADY_EXISTS"))
                .andExpect(jsonPath("$.traceId").value("registration-test"))
                .andExpect(jsonPath("$.errors", hasSize(0)));
        assertThat(count("app_user")).isEqualTo(1);
        assertThat(count("local_credential")).isEqualTo(1);
    }

    @Test
    void samePasswordHasDifferentSaltsAndEmailTagsStayDistinct() throws Exception {
        signup("member@example.com", PASSWORD).andExpect(status().isCreated());
        signup("member+tag@example.com", PASSWORD).andExpect(status().isCreated());
        List<String> hashes = jdbc.queryForList("SELECT password_hash FROM local_credential", String.class);
        assertThat(hashes).hasSize(2).doesNotHaveDuplicates();
        assertThat(hashes).allMatch(hash -> encoder.matches(PASSWORD, hash));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{}", "{\"email\":null,\"password\":null}",
        "{\"email\":123,\"password\":\"Sample!password\"}",
        "{\"email\":\"member@example.com\",\"password\":123456789012345}",
        "{\"email\":[],\"password\":\"Sample!password\"}",
        "{\"email\":\"member@example.com\",\"password\":{}}",
        "null", "[]", "{"
    })
    void malformedAndWrongTypeBodiesAreRejected(String body, CapturedOutput output) throws Exception {
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
        assertThat(count("app_user")).isZero();
        assertThat(count("local_credential")).isZero();
        assertThat(output.getAll()).doesNotContain(PASSWORD);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "no-at", "a@@example.com", ".a@example.com",
        "a..b@example.com", "a.@example.com", "a@localhost", "a@-example.com",
        "a@example-.com", "a b@example.com", "회원@example.com", "a@예시.com", "K@example.com"})
    void rejectsInvalidEmail(String email) throws Exception {
        signup(email, PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("email"));
        assertThat(count("app_user")).isZero();
    }

    @Test
    void rejectsShortAndLongPasswordsWithoutSavingOrLogging(CapturedOutput output) throws Exception {
        signup("member@example.com", "short-fake").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("password"));
        signup("member@example.com", "x".repeat(129)).andExpect(status().isBadRequest());
        assertThat(count("app_user")).isZero();
        assertThat(output.getAll()).doesNotContain("short-fake", "x".repeat(129));
    }

    @Test
    void acceptsUnicodeBoundariesWithoutTrimmingPassword() throws Exception {
        String password = " A!" + "가".repeat(7) + " ";
        signup("member@example.com", password).andExpect(status().isCreated());
        String hash = jdbc.queryForObject("SELECT password_hash FROM local_credential", String.class);
        assertThat(encoder.matches(password, hash)).isTrue();
        assertThat(encoder.matches(password.trim(), hash)).isFalse();
        signup("other@example.com", "A!" + "😀".repeat(126)).andExpect(status().isCreated());
    }

    @Test
    void concurrentRegistrationCreatesOnlyOneUserAndRollsBackLosers(CapturedOutput output) throws Exception {
        int workers = 4;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(workers)) {
            var results = new java.util.ArrayList<Future<Integer>>();
            for (int i = 0; i < workers; i++) {
                results.add(pool.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("start timeout");
                    return signup("race@example.com", PASSWORD).andReturn().getResponse().getStatus();
                }));
            }
            boolean allReady = ready.await(10, TimeUnit.SECONDS);
            start.countDown();
            assertThat(allReady).isTrue();
            var statuses = new java.util.ArrayList<Integer>();
            for (Future<Integer> result : results) statuses.add(result.get(30, TimeUnit.SECONDS));
            assertThat(statuses).containsExactlyInAnyOrder(201, 409, 409, 409);
        }
        assertThat(count("app_user")).isEqualTo(1);
        assertThat(count("local_credential")).isEqualTo(1);
        String hash = jdbc.queryForObject("SELECT password_hash FROM local_credential", String.class);
        assertThat(output.getAll()).doesNotContain(PASSWORD, hash);
    }

    private ResultActions signup(String email, String password) throws Exception {
        return mvc.perform(post("/api/users")
                .header("X-Trace-Id", "registration-test")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }
}
