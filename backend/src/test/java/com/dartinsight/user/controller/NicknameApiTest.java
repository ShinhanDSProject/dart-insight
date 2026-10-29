package com.dartinsight.user.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class NicknameApiTest {
    private static final String PASSWORD = "Sample!password";
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
    @DisplayName("닉네임을 정하기 전 현재 세션은 닉네임 null, 관리자 아님이다")
    void currentSessionHasNoNicknameBeforeSetting() throws Exception {
        String token = signIn("member@example.com");
        mvc.perform(get("/api/sessions/current").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").isNumber())
                .andExpect(jsonPath("$.nickname").isEmpty())
                .andExpect(jsonPath("$.admin").value(false));
    }

    @Test
    @DisplayName("닉네임을 정하면 앞뒤 공백을 지워 저장하고 현재 세션에 보인다")
    void setsNicknameAndShowsItInCurrentSession() throws Exception {
        String token = signIn("member@example.com");
        changeNickname(token, "\"  반도체공부중 \"")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("반도체공부중"));
        mvc.perform(get("/api/sessions/current").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.nickname").value("반도체공부중"));
    }

    @Test
    @DisplayName("지금과 같은 닉네임으로 다시 정해도 200이고, 나중에 바꿀 수 있다")
    void allowsSameNicknameAndChange() throws Exception {
        String token = signIn("member@example.com");
        changeNickname(token, "\"Chip2026\"").andExpect(status().isOk());
        changeNickname(token, "\"Chip2026\"").andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("Chip2026"));
        changeNickname(token, "\"chip2026\"").andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("chip2026"));
        changeNickname(token, "\"새닉네임\"").andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("새닉네임"));
    }

    @Test
    @DisplayName("다른 사람이 쓰는 닉네임은 대소문자만 달라도 409 COMMUNITY_NICKNAME_TAKEN이다")
    void rejectsNicknameTakenByOthers() throws Exception {
        changeNickname(signIn("first@example.com"), "\"Chip2026\"").andExpect(status().isOk());
        String other = signIn("second@example.com");
        changeNickname(other, "\"Chip2026\"")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_NICKNAME_TAKEN"))
                .andExpect(jsonPath("$.traceId").isString());
        changeNickname(other, "\"CHIP2026\"")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_NICKNAME_TAKEN"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"가\"", "\"열세글자를넘는아주긴닉네임\"", "\"닉 네임\"", "\"nick!\"", "\"ㄱㄴㄷ\"",
        "\"   \"", "123", "null", "[\"닉네임\"]"})
    @DisplayName("규칙에 맞지 않는 닉네임은 400 COMMON_INVALID_INPUT이고 필드는 nickname이다")
    void rejectsInvalidNickname(String json) throws Exception {
        changeNickname(signIn("member@example.com"), json)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("nickname"));
    }

    @Test
    @DisplayName("닉네임 정하기는 로그인이 필요하다")
    void nicknameRequiresJwt() throws Exception {
        mvc.perform(put("/api/users/current/nickname").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"반도체공부중\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
    }

    private ResultActions changeNickname(String token, String nicknameJson) throws Exception {
        return mvc.perform(put("/api/users/current/nickname").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":" + nicknameJson + "}"));
    }

    private String signIn(String email) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        String login = mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(login, "$.accessToken");
    }
}
