package com.dartinsight.favorite.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.favorite.service.FavoriteCompanyService;
import com.dartinsight.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class FavoriteCompanyApiTest {
    private static final String PASSWORD = "Sample!password";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        clear();
        for (int i = 1; i <= FavoriteCompanyService.LIMIT + 1; i++) {
            jdbc.update("INSERT INTO company (corp_code, corp_name, stock_code, created_at, updated_at)"
                    + " VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    corpCode(i), "예시기업" + i, i == 1 ? "900001" : null);
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
    @DisplayName("로그인하지 않으면 관심 기업 API를 쓸 수 없다")
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/favorite-companies"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
        mvc.perform(put("/api/favorite-companies/" + corpCode(1))).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/favorite-companies/" + corpCode(1))).andExpect(status().isUnauthorized());
        // 끝의 '/', 더 깊은 경로, 다른 메서드도 열리지 않는다
        mvc.perform(get("/api/favorite-companies/")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/favorite-companies/" + corpCode(1) + "/x")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/favorite-companies")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/favorite-companies/" + corpCode(1))).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("토큰은 유효해도 회원이 없어졌으면 세 API 모두 AUTH_UNAUTHORIZED다")
    void rejectsTokenOfDeletedUser() throws Exception {
        String token = login("member@example.com");
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");

        mvc.perform(get("/api/favorite-companies").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
        mvc.perform(put("/api/favorite-companies/" + corpCode(1)).header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/favorite-companies/" + corpCode(1)).header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("추가하면 최근 순으로 보이고 같은 기업을 다시 추가해도 한 번만 남는다")
    void addsWithoutDuplicates() throws Exception {
        String token = login("member@example.com");
        mvc.perform(put("/api/favorite-companies/" + corpCode(1)).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value(corpCode(1)))
                .andExpect(jsonPath("$.corpName").value("예시기업1"))
                .andExpect(jsonPath("$.stockCode").value("900001"))
                .andExpect(jsonPath("$.listed").value(true))
                .andExpect(jsonPath("$.addedAt").isString());
        String firstAddedAt = jdbc.queryForObject("SELECT created_at FROM favorite_company", String.class);
        add(token, 2);
        add(token, 1);

        mvc.perform(get("/api/favorite-companies").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].corpCode", contains(corpCode(2), corpCode(1))));
        assertThat(jdbc.queryForObject("SELECT created_at FROM favorite_company WHERE corp_code = ?", String.class,
                corpCode(1))).isEqualTo(firstAddedAt);
    }

    @Test
    @DisplayName("추가한 시각이 같으면 나중에 넣은 행이 앞에 온다")
    void ordersTiesByInsertion() throws Exception {
        String token = login("member@example.com");
        long userId = jdbc.queryForObject("SELECT id FROM app_user", Long.class);
        for (int i = 1; i <= 2; i++) {
            jdbc.update("INSERT INTO favorite_company (user_id, corp_code, created_at)"
                    + " VALUES (?, ?, TIMESTAMP '2026-10-26 10:00:00')", userId, corpCode(i));
        }
        mvc.perform(get("/api/favorite-companies").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.items[*].corpCode", contains(corpCode(2), corpCode(1))))
                .andExpect(jsonPath("$.items[0].addedAt").value("2026-10-26T10:00:00"));
    }

    @Test
    @DisplayName("같은 기업을 동시에 추가해도 둘 다 성공하고 한 번만 남는다")
    void concurrentSameCompanyAddsStayIdempotent() throws Exception {
        String token = login("member@example.com");
        assertThat(putTogether(token, 1, 1)).containsOnly(200);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM favorite_company", Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("한 자리 남았을 때 두 기업을 동시에 추가해도 12곳을 넘지 않는다")
    void concurrentAddsKeepLimit() throws Exception {
        String token = login("member@example.com");
        for (int i = 1; i < FavoriteCompanyService.LIMIT; i++) {
            add(token, i);
        }
        assertThat(putTogether(token, FavoriteCompanyService.LIMIT, FavoriteCompanyService.LIMIT + 1))
                .containsOnly(200);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM favorite_company", Integer.class))
                .isEqualTo(FavoriteCompanyService.LIMIT);
    }

    @Test
    @DisplayName("회원마다 목록이 따로이고 다른 회원의 관심 기업은 지울 수 없다")
    void keepsListsPerUser() throws Exception {
        String mine = login("member@example.com");
        String other = login("other@example.com");
        add(mine, 1);
        add(other, 2);

        mvc.perform(delete("/api/favorite-companies/" + corpCode(1)).header("Authorization", bearer(other)))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/favorite-companies").header("Authorization", bearer(mine)))
                .andExpect(jsonPath("$.items[*].corpCode", contains(corpCode(1))));
        mvc.perform(get("/api/favorite-companies").header("Authorization", bearer(other)))
                .andExpect(jsonPath("$.items[*].corpCode", contains(corpCode(2))));
    }

    @Test
    @DisplayName("빼면 목록에서 사라지고, 없던 기업을 빼도 204다")
    void removesQuietly() throws Exception {
        String token = login("member@example.com");
        add(token, 1);
        mvc.perform(delete("/api/favorite-companies/" + corpCode(1)).header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/favorite-companies/99999999").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/favorite-companies").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    @DisplayName("없는 고유번호는 추가하지 않고 COMPANY_NOT_FOUND다")
    void rejectsUnknownCompany() throws Exception {
        String token = login("member@example.com");
        mvc.perform(put("/api/favorite-companies/99999999").header("Authorization", bearer(token)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
    }

    @Test
    @DisplayName("12곳이 차 있으면 가장 먼저 추가한 기업을 빼고 새 기업을 넣는다")
    void dropsOldestOverLimit() throws Exception {
        String token = login("member@example.com");
        for (int i = 1; i <= FavoriteCompanyService.LIMIT + 1; i++) {
            add(token, i);
        }
        mvc.perform(get("/api/favorite-companies").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.items", hasSize(FavoriteCompanyService.LIMIT)))
                .andExpect(jsonPath("$.items[0].corpCode").value(corpCode(FavoriteCompanyService.LIMIT + 1)))
                .andExpect(jsonPath("$.items[?(@.corpCode == '" + corpCode(1) + "')]", hasSize(0)));
    }

    private void add(String token, int company) throws Exception {
        mvc.perform(put("/api/favorite-companies/" + corpCode(company)).header("Authorization", bearer(token)))
                .andExpect(status().isOk());
    }

    /** 여러 PUT을 한꺼번에 보내고 상태 코드를 모은다 */
    private List<Integer> putTogether(String token, int... companies) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(companies.length);
        try {
            List<Future<Integer>> results = new ArrayList<>();
            for (int company : companies) {
                results.add(pool.submit(() -> {
                    start.await();
                    return mvc.perform(put("/api/favorite-companies/" + corpCode(company))
                            .header("Authorization", bearer(token))).andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> result : results) {
                statuses.add(result.get(10, TimeUnit.SECONDS));
            }
            return statuses;
        } finally {
            pool.shutdownNow();
        }
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

    private static String corpCode(int i) {
        return String.format("%08d", i);
    }
}
