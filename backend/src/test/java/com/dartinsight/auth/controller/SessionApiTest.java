package com.dartinsight.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.auth.service.RefreshCookieService;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.web.WebAttributes;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SessionApiTest {
    private static final String EMAIL = "member@example.com";
    private static final String PASSWORD = "Sample!password";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void cleanUsers() {
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
    }

    @Test
    @DisplayName("로그인하면 JWT와 HttpOnly Refresh Token을 발급한다")
    void loginIssuesTokens() throws Exception {
        register();
        var response = login(PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").isNumber())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.expiresIn").value(900))
                .andExpect(cookie().httpOnly(RefreshCookieService.NAME, true))
                .andReturn().getResponse();
        String raw = response.getCookie(RefreshCookieService.NAME).getValue();
        String stored = jdbc.queryForObject("SELECT token_hash FROM refresh_token", String.class);
        assertThat(stored).isNotEqualTo(raw).hasSize(43);
    }

    @Test
    @DisplayName("잘못된 이메일과 비밀번호는 같은 인증 오류를 반환한다")
    void invalidCredentialsUseOneError() throws Exception {
        register();
        for (String body : new String[] {
            "{\"email\":\"missing@example.com\",\"password\":\"Sample!password\"}",
            "{\"email\":\"member@example.com\",\"password\":\"Wrong!password\"}"
        }) {
            mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("AUTH_INVALID_CREDENTIALS"));
        }
    }

    @Test
    @DisplayName("Refresh Token을 회전하고 이전 토큰 재사용 시 계열을 폐기한다")
    void refreshRotatesAndRejectsReplay() throws Exception {
        register();
        Cookie first = login(PASSWORD).andReturn().getResponse().getCookie(RefreshCookieService.NAME);
        Cookie second = mvc.perform(post("/api/session-refreshes").cookie(first))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie(RefreshCookieService.NAME);
        assertThat(second.getValue()).isNotEqualTo(first.getValue());
        mvc.perform(post("/api/session-refreshes").cookie(first)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/session-refreshes").cookie(second)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("로그아웃하면 Refresh Token을 폐기하고 쿠키를 지운다")
    void logoutRevokesRefreshToken() throws Exception {
        register();
        Cookie refresh = login(PASSWORD).andReturn().getResponse().getCookie(RefreshCookieService.NAME);
        mvc.perform(delete("/api/sessions/current").cookie(refresh))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge(RefreshCookieService.NAME, 0));
        mvc.perform(post("/api/session-refreshes").cookie(refresh)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("현재 세션 조회는 유효한 JWT가 필요하다")
    void currentSessionRequiresJwt() throws Exception {
        register();
        var login = login(PASSWORD).andReturn().getResponse();
        String token = com.jayway.jsonpath.JsonPath.read(login.getContentAsString(), "$.accessToken");
        mvc.perform(get("/api/sessions/current")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/sessions/current").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").isNumber());
    }

    @Test
    @DisplayName("소셜 로그인 중의 서버 세션으로는 JWT가 필요한 API를 쓸 수 없다")
    void oauthSessionDoesNotAuthenticateApi() throws Exception {
        var user = new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("OAUTH2_USER")),
                Map.of("sub", "provider-user"), "sub");
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                new SecurityContextImpl(new OAuth2AuthenticationToken(user, user.getAuthorities(), "google")));
        mvc.perform(get("/api/sessions/current").session(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
    }

    @Test
    @DisplayName("제공자 쪽에서 소셜 로그인이 실패하면 세션을 지우고 실패 화면으로 보낸다")
    void providerFailureRedirectsToErrorAndClearsSession() throws Exception {
        var session = new MockHttpSession();
        mvc.perform(get("/api/social-sessions/failure").session(session).requestAttr(
                        WebAttributes.AUTHENTICATION_EXCEPTION,
                        new OAuth2AuthenticationException(new OAuth2Error("access_denied"))))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl("http://localhost:5173/login?social=error"));
        assertThat(session.isInvalid()).isTrue();
    }

    @Test
    @DisplayName("제공자 콜백이 실패하면 기본 로그인 페이지가 아니라 실패 처리로 forward한다")
    void providerCallbackFailureForwardsToFailureEndpoint() throws Exception {
        var result = mvc.perform(get("/login/oauth2/code/google")
                        .param("error", "access_denied").param("state", "unknown-state"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/api/social-sessions/failure"))
                .andReturn();
        assertThat(result.getRequest().getAttribute(WebAttributes.AUTHENTICATION_EXCEPTION))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    private void register() throws Exception {
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isCreated());
    }

    private org.springframework.test.web.servlet.ResultActions login(String password) throws Exception {
        return mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + EMAIL + "\",\"password\":\"" + password + "\"}"));
    }
}
