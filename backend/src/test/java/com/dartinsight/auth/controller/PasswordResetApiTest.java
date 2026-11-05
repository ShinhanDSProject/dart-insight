package com.dartinsight.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.auth.client.PasswordResetMailer;
import com.dartinsight.auth.service.RefreshCookieService;
import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class PasswordResetApiTest {
    private static final String EMAIL = "member@example.com";
    private static final String PASSWORD = "Sample!password";
    private static final String NEW_PASSWORD = "Changed!password";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired RecordingMailer mailer;

    /** 보낸 메일을 모아 두는 가짜 발송기(실제 SMTP를 부르지 않음) */
    static class RecordingMailer implements PasswordResetMailer {
        final List<String[]> sent = new ArrayList<>();

        @Override
        public void send(String toEmail, String resetLink) { sent.add(new String[] {toEmail, resetLink}); }
    }

    @TestConfiguration
    static class MailerConfig {
        @Bean
        @Primary
        RecordingMailer recordingMailer() { return new RecordingMailer(); }
    }

    // 다른 테스트가 app_user를 지울 때 외래 키에 걸리지 않게 끝난 뒤에도 비운다
    @BeforeEach
    @AfterEach
    void clean() {
        jdbc.update("DELETE FROM password_reset_token");
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
        mailer.sent.clear();
    }

    @Test
    @DisplayName("가입한 이메일이면 204로 답하고 그 주소로 재설정 링크를 보내며 DB에는 해시만 둔다")
    void requestSendsLinkToRegisteredEmail() throws Exception {
        register();
        requestReset(" Member@Example.com ").andExpect(status().isNoContent());

        assertThat(mailer.sent).hasSize(1);
        assertThat(mailer.sent.get(0)[0]).isEqualTo(EMAIL);
        String token = tokenOf(mailer.sent.get(0)[1]);
        String stored = jdbc.queryForObject("SELECT token_hash FROM password_reset_token", String.class);
        assertThat(stored).isNotEqualTo(token).hasSize(43);
    }

    @Test
    @DisplayName("가입하지 않은 이메일도 같은 204이고 메일은 가지 않는다")
    void unknownEmailGetsSameResponseWithoutMail() throws Exception {
        requestReset("nobody@example.com").andExpect(status().isNoContent());
        assertThat(mailer.sent).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM password_reset_token", Integer.class)).isZero();
    }

    @Test
    @DisplayName("이메일 형식이 틀리면 400으로 email 필드를 알린다")
    void invalidEmailIsRejected() throws Exception {
        requestReset("not-an-email").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("email"));
    }

    @Test
    @DisplayName("1분 안에 다시 요청하면 새 링크·메일을 만들지 않는다")
    void repeatedRequestWithinIntervalIsIgnored() throws Exception {
        register();
        requestReset(EMAIL).andExpect(status().isNoContent());
        requestReset(EMAIL).andExpect(status().isNoContent());
        assertThat(mailer.sent).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM password_reset_token", Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("링크로 새 비밀번호를 정하면 새 비밀번호로 로그인되고 기존 세션은 끊기며 이메일이 확인된다")
    void confirmChangesPasswordAndRevokesSessions() throws Exception {
        register();
        Cookie refresh = login(PASSWORD).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie(RefreshCookieService.NAME);
        String token = issueToken();

        confirm(token, NEW_PASSWORD).andExpect(status().isNoContent());

        login(PASSWORD).andExpect(status().isUnauthorized());
        login(NEW_PASSWORD).andExpect(status().isOk());
        mvc.perform(post("/api/session-refreshes").cookie(refresh)).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT email_verified FROM local_credential", Boolean.class)).isTrue();
    }

    @Test
    @DisplayName("한 번 쓴 링크·잘못된 링크·만료된 링크는 같은 AUTH_INVALID_RESET_TOKEN이다")
    void usedWrongAndExpiredTokensAreRejected() throws Exception {
        register();
        String token = issueToken();
        confirm(token, NEW_PASSWORD).andExpect(status().isNoContent());
        expectInvalidToken(confirm(token, "Another!password"));
        expectInvalidToken(confirm("wrong-token", NEW_PASSWORD));

        jdbc.update("UPDATE password_reset_token SET created_at = TIMESTAMPADD(MINUTE, -5, created_at)");
        String expiring = issueToken();
        jdbc.update("UPDATE password_reset_token SET expires_at = TIMESTAMPADD(MINUTE, -31, expires_at)");
        expectInvalidToken(confirm(expiring, NEW_PASSWORD));
    }

    @Test
    @DisplayName("새로 요청하면 이전 링크는 못 쓴다")
    void newRequestRetiresPreviousLink() throws Exception {
        register();
        String first = issueToken();
        jdbc.update("UPDATE password_reset_token SET created_at = TIMESTAMPADD(MINUTE, -5, created_at)");
        String second = issueToken();

        expectInvalidToken(confirm(first, NEW_PASSWORD));
        confirm(second, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("새 비밀번호가 규칙에 맞지 않으면 400이고 링크는 그대로 쓸 수 있다")
    void weakPasswordKeepsTokenUsable() throws Exception {
        register();
        String token = issueToken();
        confirm(token, "short").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("password"));
        confirm(token, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    private void register() throws Exception {
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isCreated());
    }

    private ResultActions login(String password) throws Exception {
        return mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + EMAIL + "\",\"password\":\"" + password + "\"}"));
    }

    private ResultActions requestReset(String email) throws Exception {
        return mvc.perform(post("/api/password-resets").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}"));
    }

    private ResultActions confirm(String token, String password) throws Exception {
        return mvc.perform(post("/api/password-reset-confirmations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"password\":\"" + password + "\"}"));
    }

    /** 재설정을 요청하고 마지막으로 보낸 메일의 토큰을 꺼낸다 */
    private String issueToken() throws Exception {
        requestReset(EMAIL).andExpect(status().isNoContent());
        return tokenOf(mailer.sent.get(mailer.sent.size() - 1)[1]);
    }

    private static String tokenOf(String link) {
        assertThat(link).startsWith("http://localhost:5173/password-reset?token=");
        return link.substring(link.indexOf("token=") + "token=".length());
    }

    private static void expectInvalidToken(ResultActions result) throws Exception {
        result.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("AUTH_INVALID_RESET_TOKEN"));
    }
}
