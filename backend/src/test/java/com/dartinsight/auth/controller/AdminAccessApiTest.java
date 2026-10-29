package com.dartinsight.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 관리자 지정과 관리자 API 확인(ADR-0040). 관리자 API(#461)가 아직 없어서 관리자 경로 아래의 없는 주소로
 * 확인한다: 관리자가 아니면 403에서 막히고, 관리자면 확인을 지나 404가 된다.
 */
@SpringBootTest(properties = "app.auth.admin-emails= Admin@Example.com ,social-admin@example.com")
@AutoConfigureMockMvc
class AdminAccessApiTest {
    private static final String PASSWORD = "Sample!password";
    private static final String ADMIN_PATH = "/api/admin/reports";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void cleanUsers() {
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM social_account");
        jdbc.update("DELETE FROM app_user");
    }

    @Test
    @DisplayName("소유가 확인된 일반 가입 이메일이 목록에 있으면 로그인할 때 관리자가 되고 관리자 경로를 지난다")
    void verifiedListedEmailBecomesAdminOnLogin() throws Exception {
        register("admin@example.com");
        jdbc.update("UPDATE local_credential SET email_verified = TRUE");
        String token = login("admin@example.com");

        assertThat(roles()).containsExactly("ADMIN");
        mvc.perform(get("/api/sessions/current").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.admin").value(true));
        mvc.perform(get(ADMIN_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMON_NOT_FOUND"));
    }

    @Test
    @DisplayName("이메일 소유를 확인하지 않은 일반 가입 계정은 목록에 있어도 관리자가 아니고 관리자 API는 403이다")
    void unverifiedEmailIsForbidden() throws Exception {
        register("admin@example.com");
        String token = login("admin@example.com");

        assertThat(roles()).containsExactly("USER");
        mvc.perform(get(ADMIN_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("관리자만 쓸 수 있습니다."))
                .andExpect(jsonPath("$.traceId").isString())
                .andExpect(jsonPath("$.errors").isEmpty());
    }

    @Test
    @DisplayName("관리자 API는 로그인하지 않으면 401이다")
    void adminPathRequiresJwt() throws Exception {
        mvc.perform(get(ADMIN_PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
    }

    @Test
    @DisplayName("DB에서 관리자를 내리면 이미 받은 토큰으로도 다음 요청부터 403이다")
    void demotionAppliesToNextRequest() throws Exception {
        register("admin@example.com");
        jdbc.update("UPDATE local_credential SET email_verified = TRUE");
        String token = login("admin@example.com");
        jdbc.update("UPDATE app_user SET role = 'USER'");

        mvc.perform(get(ADMIN_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("제공자가 확인한 소셜 이메일이 목록에 있으면 소셜 로그인할 때 관리자가 된다")
    void verifiedSocialEmailBecomesAdmin() throws Exception {
        socialLogin("google-admin", "Social-Admin@example.com", true);
        assertThat(roles()).containsExactly("ADMIN");
    }

    @Test
    @DisplayName("제공자가 확인하지 않은 소셜 이메일은 목록에 있어도 관리자가 되지 않는다")
    void unverifiedSocialEmailStaysUser() throws Exception {
        socialLogin("google-user", "social-admin@example.com", false);
        assertThat(roles()).containsExactly("USER");
    }

    private List<String> roles() {
        return jdbc.queryForList("SELECT role FROM app_user", String.class);
    }

    private void socialLogin(String providerUserId, String email, boolean verified) throws Exception {
        var user = new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("OAUTH2_USER")),
                Map.of("sub", providerUserId, "email", email, "email_verified", verified), "sub");
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                new SecurityContextImpl(new OAuth2AuthenticationToken(user, user.getAuthorities(), "google")));
        mvc.perform(get("/api/social-sessions/callback").session(session))
                .andExpect(status().isFound());
    }

    private void register(String email) throws Exception {
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body(email)))
                .andExpect(status().isCreated());
    }

    private String login(String email) throws Exception {
        String response = mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON)
                        .content(body(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }

    private String body(String email) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
    }
}
