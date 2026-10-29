package com.dartinsight.community.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.company.service.CompanyImportService;
import com.dartinsight.dart.domain.CorpCodeEntry;
import com.dartinsight.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 커뮤니티 신고·관리자 처리·재게시 청구 API(6.6 #461): 신고만으로 가리지 않음, 블라인드는 작성자에게만 본문·사유,
 * 처리 기록, 관리자만, 재게시 청구와 기한 지남은 목록에 다시 올라옴, 닉네임만 내보냄.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CommunityReportApiTest {
    private static final String PASSWORD = "Sample!password";
    private static final String CORP = "00000001";
    private static final String ADMIN_REPORTS = "/api/admin/reports";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CompanyImportService companyImportService;

    private String alice;
    private String bob;
    private String carol;
    private String admin;

    @BeforeEach
    void setUp() throws Exception {
        clear();
        companyImportService.save(List.of(
                new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        alice = signIn("alice@example.com", "반도체공부중");
        bob = signIn("bob@example.com", "Chip2026");
        carol = signIn("carol@example.com", "캐롤");
        admin = signIn("admin@example.com", "운영자");
        jdbc.update("UPDATE app_user SET role = 'ADMIN' WHERE nickname = '운영자'");
    }

    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM social_account");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
    }

    @Test
    @DisplayName("신고하면 접수되고 글은 그대로 보이며, 같은 사람이 다시 신고하면 409 COMMUNITY_ALREADY_REPORTED다")
    void reportKeepsPostVisibleAndRejectsDuplicate() throws Exception {
        long postId = writePost(alice, "합병 확정이라고 들었어요");

        report("/api/posts/" + postId, bob, "FALSE_RUMOR").andExpect(status().isNoContent());
        report("/api/posts/" + postId, carol, "PAID_LEADING").andExpect(status().isNoContent());
        report("/api/posts/" + postId, bob, "DEFAMATION")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_ALREADY_REPORTED"));

        mvc.perform(get("/api/posts/" + postId))
                .andExpect(jsonPath("$.post.state").value("VISIBLE"))
                .andExpect(jsonPath("$.post.body").value("합병 확정이라고 들었어요"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_report", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT report_count FROM community_report", Integer.class)).isEqualTo(2);
    }

    @Test
    @DisplayName("신고가 여러 건 쌓여도 처리 전에는 가려지지 않고, 관리자 목록에는 사유별 건수와 닉네임만 나온다")
    void reportsWaitForAdminAndListShowsNicknamesOnly() throws Exception {
        long postId = writePost(alice, "본문");
        report("/api/posts/" + postId, bob, "FALSE_RUMOR");
        report("/api/posts/" + postId, carol, "FALSE_RUMOR");

        mvc.perform(get("/api/companies/" + CORP + "/posts"))
                .andExpect(jsonPath("$.items[0].state").value("VISIBLE"));
        String list = mvc.perform(withToken(get(ADMIN_REPORTS), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queue").value("todo"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].status").value("OPEN"))
                .andExpect(jsonPath("$.items[0].todo").value("PENDING"))
                .andExpect(jsonPath("$.items[0].target.type").value("POST"))
                .andExpect(jsonPath("$.items[0].target.postId").value(postId))
                .andExpect(jsonPath("$.items[0].target.commentId").isEmpty())
                .andExpect(jsonPath("$.items[0].target.corpName").value("예시전자"))
                .andExpect(jsonPath("$.items[0].target.author.nickname").value("반도체공부중"))
                .andExpect(jsonPath("$.items[0].target.body").value("본문"))
                .andExpect(jsonPath("$.items[0].reportCount").value(2))
                .andExpect(jsonPath("$.items[0].reasonCounts.FALSE_RUMOR").value(2))
                .andExpect(jsonPath("$.items[0].reasonCounts.DEFAMATION").value(0))
                .andExpect(jsonPath("$.items[0].moderations", hasSize(0)))
                .andReturn().getResponse().getContentAsString();
        assertThat(list).doesNotContain("Chip2026", "캐롤", "example.com", "userId", "reporter");
    }

    @Test
    @DisplayName("사유가 네 값이 아니면 400, 자기 글은 403, 로그인하지 않으면 401, 없는 글은 404다")
    void validatesReport() throws Exception {
        long postId = writePost(alice, "본문");

        for (String body : List.of("{\"reason\":\"SPAM\"}", "{\"reason\":1}", "{}")) {
            mvc.perform(withToken(post("/api/posts/" + postId + "/reports"), bob)
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].field").value("reason"));
        }
        report("/api/posts/" + postId, alice, "DEFAMATION")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("COMMUNITY_FORBIDDEN"));
        mvc.perform(post("/api/posts/" + postId + "/reports").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"DEFAMATION\"}"))
                .andExpect(status().isUnauthorized());
        report("/api/posts/999999", bob, "DEFAMATION")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMUNITY_POST_NOT_FOUND"));
    }

    @Test
    @DisplayName("블라인드하면 다른 사람에게는 본문이 없고 작성자에게는 본문·사유·기한이 있으며, 처리 기록이 남는다")
    void blindHidesBodyFromOthersButShowsAuthor() throws Exception {
        long postId = writePost(alice, "본문");
        report("/api/posts/" + postId, bob, "FALSE_RUMOR");
        long reportId = reportId("POST", postId);

        moderate(reportId, admin, "{\"decision\":\"BLIND\",\"reason\":\"확인되지 않은 합병설\",\"blindDays\":7}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BLINDED"))
                .andExpect(jsonPath("$.todo").isEmpty())
                .andExpect(jsonPath("$.target.state").value("BLINDED"))
                .andExpect(jsonPath("$.blindUntil").isString())
                .andExpect(jsonPath("$.moderations[0].decision").value("BLIND"))
                .andExpect(jsonPath("$.moderations[0].reason").value("확인되지 않은 합병설"))
                .andExpect(jsonPath("$.moderations[0].blindDays").value(7))
                .andExpect(jsonPath("$.moderations[0].admin.nickname").value("운영자"));

        for (String viewer : new String[] {null, bob}) {
            mvc.perform(viewer == null ? get("/api/posts/" + postId) : withToken(get("/api/posts/" + postId), viewer))
                    .andExpect(jsonPath("$.post.state").value("BLINDED"))
                    .andExpect(jsonPath("$.post.body").isEmpty())
                    .andExpect(jsonPath("$.post.blind").isEmpty());
        }
        mvc.perform(withToken(get("/api/posts/" + postId), alice))
                .andExpect(jsonPath("$.post.body").value("본문"))
                .andExpect(jsonPath("$.post.blind.reportId").value(reportId))
                .andExpect(jsonPath("$.post.blind.reason").value("확인되지 않은 합병설"))
                .andExpect(jsonPath("$.post.blind.blindUntil").isString())
                .andExpect(jsonPath("$.post.blind.expired").value(false))
                .andExpect(jsonPath("$.post.blind.repostRequested").value(false));

        Map<String, Object> record = jdbc.queryForMap("SELECT m.admin_id, m.decision, m.reason, m.blind_days,"
                + " m.blind_until, m.created_at, u.nickname FROM community_moderation m"
                + " JOIN app_user u ON u.id = m.admin_id");
        assertThat(record.get("nickname")).isEqualTo("운영자");
        assertThat(record.get("decision")).isEqualTo("BLIND");
        assertThat(record.get("blind_until")).isNotNull();
        mvc.perform(withToken(get(ADMIN_REPORTS), admin)).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(withToken(get(ADMIN_REPORTS).param("queue", "all"), admin))
                .andExpect(jsonPath("$.queue").value("all"))
                .andExpect(jsonPath("$.items[0].status").value("BLINDED"));
        report("/api/posts/" + postId, carol, "DEFAMATION")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_TARGET_UNAVAILABLE"));
    }

    @Test
    @DisplayName("관리자가 아니면 신고 목록·처리 API가 403 AUTH_FORBIDDEN이다")
    void nonAdminIsForbidden() throws Exception {
        long postId = writePost(alice, "본문");
        report("/api/posts/" + postId, bob, "FALSE_RUMOR");
        long reportId = reportId("POST", postId);

        mvc.perform(withToken(get(ADMIN_REPORTS), bob))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_FORBIDDEN"));
        moderate(reportId, alice, "{\"decision\":\"KEEP\",\"reason\":\"문제없음\"}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_FORBIDDEN"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_moderation", Integer.class)).isZero();
    }

    @Test
    @DisplayName("재게시를 청구하면 목록에 '재게시 청구'로 올라오고, 같은 블라인드에 두 번이면 409, 다시 블라인드하면 새로 청구한다")
    void repostRequestReturnsToQueueOncePerBlind() throws Exception {
        long postId = writePost(alice, "본문");
        report("/api/posts/" + postId, bob, "FALSE_RUMOR");
        long reportId = reportId("POST", postId);
        moderate(reportId, admin, "{\"decision\":\"BLIND\",\"reason\":\"사유\",\"blindDays\":3}");

        repost(reportId, bob, "{}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("COMMUNITY_FORBIDDEN"));
        repost(reportId, alice, "{\"message\":\"  출처 기사 링크를 붙였습니다.  \"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reportId").value(reportId))
                .andExpect(jsonPath("$.createdAt").isString());
        repost(reportId, alice, "{}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_REPOST_ALREADY_REQUESTED"));
        mvc.perform(withToken(get(ADMIN_REPORTS), admin))
                .andExpect(jsonPath("$.items[0].todo").value("REPOST_REQUESTED"))
                .andExpect(jsonPath("$.items[0].repostRequest.message").value("출처 기사 링크를 붙였습니다."));
        mvc.perform(withToken(get("/api/posts/" + postId), alice))
                .andExpect(jsonPath("$.post.blind.repostRequested").value(true));

        moderate(reportId, admin, "{\"decision\":\"BLIND\",\"reason\":\"여전히 근거 없음\",\"blindDays\":7}");
        mvc.perform(withToken(get(ADMIN_REPORTS), admin)).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(withToken(post("/api/reports/" + reportId + "/repost-requests"), alice))
                .andExpect(status().isCreated());

        moderate(reportId, admin, "{\"decision\":\"KEEP\",\"reason\":\"출처 확인\"}")
                .andExpect(jsonPath("$.status").value("KEPT"))
                .andExpect(jsonPath("$.target.state").value("VISIBLE"))
                .andExpect(jsonPath("$.moderations", hasSize(3)));
        mvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.post.body").value("본문"));
        repost(reportId, alice, "{}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_REPOST_NOT_ALLOWED"));
        repost(999999, alice, "{}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMUNITY_REPORT_NOT_FOUND"));
    }

    @Test
    @DisplayName("블라인드 기한이 지나면 목록에 '기한 지남'으로 올라오고 처리 전까지 가려진 채다. 재게시 청구가 있으면 그쪽이 먼저다")
    void expiredBlindReturnsToQueueButStaysHidden() throws Exception {
        long postId = writePost(alice, "본문");
        report("/api/posts/" + postId, bob, "FALSE_RUMOR");
        long reportId = reportId("POST", postId);
        moderate(reportId, admin, "{\"decision\":\"BLIND\",\"reason\":\"사유\",\"blindDays\":1}");
        // 하루 블라인드의 기한을 이틀 앞당겨 이미 지난 것으로 만든다(기한 판정 자체는 ReportStateTest가 Clock 값으로 확인)
        jdbc.update("UPDATE community_report SET blind_until = TIMESTAMPADD(DAY, -2, blind_until) WHERE id = ?",
                reportId);

        mvc.perform(withToken(get(ADMIN_REPORTS), admin))
                .andExpect(jsonPath("$.items[0].status").value("BLINDED"))
                .andExpect(jsonPath("$.items[0].todo").value("EXPIRED"));
        mvc.perform(get("/api/posts/" + postId))
                .andExpect(jsonPath("$.post.state").value("BLINDED"))
                .andExpect(jsonPath("$.post.body").isEmpty());
        mvc.perform(withToken(get("/api/posts/" + postId), alice))
                .andExpect(jsonPath("$.post.blind.expired").value(true));

        repost(reportId, alice, "{}").andExpect(status().isCreated());
        mvc.perform(withToken(get(ADMIN_REPORTS), admin))
                .andExpect(jsonPath("$.items[0].todo").value("REPOST_REQUESTED"));
    }

    @Test
    @DisplayName("유지하면 목록에서 빠지고, 그 뒤 다른 사람이 신고하면 다시 '대기'로 올라온다")
    void newReportAfterKeepReopens() throws Exception {
        long postId = writePost(alice, "본문");
        report("/api/posts/" + postId, bob, "FALSE_RUMOR");
        long reportId = reportId("POST", postId);

        moderate(reportId, admin, "{\"decision\":\"KEEP\",\"reason\":\"의견 표현\",\"blindDays\":7}")
                .andExpect(jsonPath("$.status").value("KEPT"))
                .andExpect(jsonPath("$.blindUntil").isEmpty())
                .andExpect(jsonPath("$.moderations[0].blindDays").isEmpty());
        mvc.perform(withToken(get(ADMIN_REPORTS), admin)).andExpect(jsonPath("$.totalItems").value(0));

        report("/api/posts/" + postId, carol, "DEFAMATION").andExpect(status().isNoContent());
        mvc.perform(withToken(get(ADMIN_REPORTS), admin))
                .andExpect(jsonPath("$.items[0].status").value("OPEN"))
                .andExpect(jsonPath("$.items[0].todo").value("PENDING"))
                .andExpect(jsonPath("$.items[0].reportCount").value(2));
    }

    @Test
    @DisplayName("삭제하면 작성자가 지운 것과 같고, 삭제한 신고는 다시 처리하면 409 COMMUNITY_REPORT_CLOSED다")
    void deleteClosesReport() throws Exception {
        long postId = writePost(alice, "본문");
        report("/api/posts/" + postId, bob, "PERSONAL_INFO");
        long reportId = reportId("POST", postId);

        moderate(reportId, admin, "{\"decision\":\"DELETE\",\"reason\":\"전화번호 노출\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELETED"))
                .andExpect(jsonPath("$.target.state").value("DELETED"))
                .andExpect(jsonPath("$.target.body").value("본문"));
        mvc.perform(get("/api/posts/" + postId)).andExpect(status().isNotFound());
        moderate(reportId, admin, "{\"decision\":\"KEEP\",\"reason\":\"되돌림\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_REPORT_CLOSED"));
        moderate(999999, admin, "{\"decision\":\"KEEP\",\"reason\":\"사유\"}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMUNITY_REPORT_NOT_FOUND"));
    }

    @Test
    @DisplayName("댓글도 신고·블라인드·삭제되고, 관리자가 댓글을 지우면 글의 댓글 수에서 빠진다")
    void commentReportsAndModeration() throws Exception {
        long postId = writePost(alice, "글");
        long first = writeComment(bob, postId, "가릴 댓글");
        long second = writeComment(bob, postId, "지울 댓글");
        report("/api/comments/" + first, alice, "DEFAMATION").andExpect(status().isNoContent());
        report("/api/comments/" + second, carol, "PERSONAL_INFO").andExpect(status().isNoContent());
        report("/api/comments/" + first, bob, "DEFAMATION").andExpect(status().isForbidden());

        long blindId = reportId("COMMENT", first);
        moderate(blindId, admin, "{\"decision\":\"BLIND\",\"reason\":\"모욕\",\"blindDays\":30}")
                .andExpect(jsonPath("$.target.type").value("COMMENT"))
                .andExpect(jsonPath("$.target.postId").value(postId))
                .andExpect(jsonPath("$.target.commentId").value(first))
                .andExpect(jsonPath("$.target.author.nickname").value("Chip2026"));
        moderate(reportId("COMMENT", second), admin, "{\"decision\":\"DELETE\",\"reason\":\"개인정보\"}");

        mvc.perform(withToken(get("/api/posts/" + postId), alice))
                .andExpect(jsonPath("$.post.commentCount").value(1))
                .andExpect(jsonPath("$.comments", hasSize(1)))
                .andExpect(jsonPath("$.comments[0].state").value("BLINDED"))
                .andExpect(jsonPath("$.comments[0].body").isEmpty())
                .andExpect(jsonPath("$.comments[0].blind").isEmpty());
        mvc.perform(withToken(get("/api/posts/" + postId), bob))
                .andExpect(jsonPath("$.comments[0].body").value("가릴 댓글"))
                .andExpect(jsonPath("$.comments[0].blind.reportId").value(blindId))
                .andExpect(jsonPath("$.comments[0].blind.reason").value("모욕"));
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @ValueSource(strings = {
        "{\"decision\":\"BLIND\",\"reason\":\"사유\"}",
        "{\"decision\":\"BLIND\",\"reason\":\"사유\",\"blindDays\":0}",
        "{\"decision\":\"BLIND\",\"reason\":\"사유\",\"blindDays\":31}",
        "{\"decision\":\"BLIND\",\"reason\":\"사유\",\"blindDays\":\"7\"}",
        "{\"decision\":\"HIDE\",\"reason\":\"사유\"}",
        "{\"decision\":\"KEEP\",\"reason\":\"   \"}",
        "{\"decision\":\"KEEP\"}"
    })
    @DisplayName("처리 요청의 결정·사유·블라인드 기간이 규칙에 맞지 않으면 400이고 기록이 남지 않는다")
    void validatesModeration(String body) throws Exception {
        long postId = writePost(alice, "본문");
        report("/api/posts/" + postId, bob, "FALSE_RUMOR");

        moderate(reportId("POST", postId), admin, body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_moderation", Integer.class)).isZero();
    }

    @Test
    @DisplayName("처리 사유는 500자까지다")
    void moderationReasonLimit() throws Exception {
        long postId = writePost(alice, "본문");
        report("/api/posts/" + postId, bob, "FALSE_RUMOR");
        long reportId = reportId("POST", postId);

        moderate(reportId, admin, "{\"decision\":\"KEEP\",\"reason\":\"" + "가".repeat(501) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("reason"));
        moderate(reportId, admin, "{\"decision\":\"KEEP\",\"reason\":\"" + "가".repeat(500) + "\"}")
                .andExpect(status().isOk());
    }

    private ResultActions report(String target, String token, String reason) throws Exception {
        return mvc.perform(withToken(post(target + "/reports"), token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"" + reason + "\"}"));
    }

    private ResultActions moderate(long reportId, String token, String body) throws Exception {
        return mvc.perform(withToken(patch(ADMIN_REPORTS + "/" + reportId), token)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions repost(long reportId, String token, String body) throws Exception {
        return mvc.perform(withToken(post("/api/reports/" + reportId + "/repost-requests"), token)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private long reportId(String targetType, long targetId) {
        return jdbc.queryForObject("SELECT id FROM community_report WHERE target_type = ? AND target_id = ?",
                Long.class, targetType, targetId);
    }

    private long writePost(String token, String body) throws Exception {
        String response = mvc.perform(withToken(post("/api/companies/" + CORP + "/posts"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.postId")).longValue();
    }

    private long writeComment(String token, long postId, String body) throws Exception {
        String response = mvc.perform(withToken(post("/api/posts/" + postId + "/comments"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.commentId")).longValue();
    }

    private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder request, String token) {
        return request.header("Authorization", "Bearer " + token);
    }

    private String signIn(String email, String nickname) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        String login = mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(login, "$.accessToken");
        mvc.perform(withToken(put("/api/users/current/nickname"), token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"" + nickname + "\"}")).andExpect(status().isOk());
        return token;
    }
}
