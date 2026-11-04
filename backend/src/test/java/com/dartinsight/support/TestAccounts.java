package com.dartinsight.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 일반 가입·로그인으로 회원을 만들고 Access Token을 받는 테스트 도우미. 회원 표 정리도 여기서 한다. */
public final class TestAccounts {
    public static final String PASSWORD = "Sample!password";

    private TestAccounts() {
    }

    /** 가입하고 로그인한 Access Token. nickname이 null이면 닉네임을 정하지 않는다 */
    public static String signIn(MockMvc mvc, String email, String nickname) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        String login = mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(login, "$.accessToken");
        if (nickname != null) {
            mvc.perform(withToken(put("/api/users/current/nickname"), token)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"" + nickname + "\"}"))
                    .andExpect(status().isOk());
        }
        return token;
    }

    /** 일반 가입 이메일의 회원을 관리자로 올린다 */
    public static void grantAdmin(JdbcTemplate jdbc, String email) {
        jdbc.update("UPDATE app_user SET role = 'ADMIN' WHERE id = "
                + "(SELECT user_id FROM local_credential WHERE email = ?)", email);
    }

    public static long userId(JdbcTemplate jdbc, String email) {
        return jdbc.queryForObject("SELECT user_id FROM local_credential WHERE email = ?", Long.class, email);
    }

    public static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder request, String token) {
        return request.header("Authorization", "Bearer " + token);
    }

    /** TestData.clearAll 뒤에 회원 표를 지운다(자식 표부터) */
    public static void clearUsers(JdbcTemplate jdbc) {
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM social_account");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
    }
}
