package com.dartinsight.community.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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

/** 커뮤니티 글·댓글·좋아요 API(6.6 #460): 읽기는 로그인 없이, 쓰기는 본인만, 지운 글·댓글, 목록 순서, 좋아요 한 번 */
@SpringBootTest
@AutoConfigureMockMvc
class CommunityApiTest {
    private static final String PASSWORD = "Sample!password";
    private static final String CORP = "00000001";
    private static final String POSTS = "/api/companies/" + CORP + "/posts";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CompanyImportService companyImportService;

    private String alice;
    private String bob;

    @BeforeEach
    void setUp() throws Exception {
        clear();
        companyImportService.save(List.of(
                new CorpCodeEntry(CORP, "예시전자", null, "900001", LocalDate.of(2026, 1, 1))));
        alice = signIn("alice@example.com", "반도체공부중");
        bob = signIn("bob@example.com", "Chip2026");
    }

    // 회원·기업 표를 지우는 다른 테스트가 외래 키에 걸리지 않게 끝날 때도 지운다
    @AfterEach
    void clear() {
        TestData.clearAll(jdbc);
        jdbc.update("DELETE FROM refresh_token");
        jdbc.update("DELETE FROM social_account");
        jdbc.update("DELETE FROM local_credential");
        jdbc.update("DELETE FROM app_user");
    }

    @Test
    @DisplayName("글을 쓰면 최신순 맨 위에 닉네임·시각·좋아요 0·댓글 0으로 나오고 작성자 ID·이메일은 없다")
    void newPostComesFirstWithNicknameOnly() throws Exception {
        writePost(alice, "첫 글입니다.");
        writePost(alice, "  HBM 문장이 새로 들어갔네요.  ")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.postId").isNumber())
                .andExpect(jsonPath("$.corpCode").value(CORP))
                .andExpect(jsonPath("$.author.nickname").value("반도체공부중"))
                .andExpect(jsonPath("$.author.mine").value(true))
                .andExpect(jsonPath("$.state").value("VISIBLE"))
                .andExpect(jsonPath("$.body").value("HBM 문장이 새로 들어갔네요."))
                .andExpect(jsonPath("$.quote").isEmpty())
                .andExpect(jsonPath("$.blind").isEmpty())
                .andExpect(jsonPath("$.editedAt").isEmpty());

        mvc.perform(get(POSTS))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corpCode").value(CORP))
                .andExpect(jsonPath("$.sort").value("latest"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].body").value("HBM 문장이 새로 들어갔네요."))
                .andExpect(jsonPath("$.items[0].author.nickname").value("반도체공부중"))
                .andExpect(jsonPath("$.items[0].author.mine").value(false))
                .andExpect(jsonPath("$.items[0].author.userId").doesNotExist())
                .andExpect(jsonPath("$.items[0].author.email").doesNotExist())
                .andExpect(jsonPath("$.items[0].userId").doesNotExist())
                .andExpect(jsonPath("$.items[0].likeCount").value(0))
                .andExpect(jsonPath("$.items[0].commentCount").value(0))
                .andExpect(jsonPath("$.items[0].liked").value(false))
                .andExpect(jsonPath("$.items[0].createdAt").value(
                        org.hamcrest.Matchers.matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}")))
                .andExpect(jsonPath("$.items[1].body").value("첫 글입니다."));
    }

    @Test
    @DisplayName("글이 없으면 빈 목록이다")
    void emptyBoard() throws Exception {
        mvc.perform(get(POSTS))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"\"", "\"   \"", "123", "null", "[\"글\"]"})
    @DisplayName("빈 본문이나 문자열이 아닌 본문은 400 COMMON_INVALID_INPUT(body)이다")
    void rejectsEmptyPostBody(String bodyJson) throws Exception {
        mvc.perform(withToken(post(POSTS), alice).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":" + bodyJson + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_INVALID_INPUT"))
                .andExpect(jsonPath("$.errors[0].field").value("body"));
        assertThat(count("community_post")).isZero();
    }

    @Test
    @DisplayName("글은 2,000자까지 쓰고 2,001자는 400이다")
    void postBodyLimit() throws Exception {
        writePost(alice, "가".repeat(2000)).andExpect(status().isCreated());
        writePost(alice, "가".repeat(2001))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("body"));
    }

    @Test
    @DisplayName("쓰기·댓글·좋아요는 로그인이 필요하고, 목록·글 읽기는 로그인 없이 된다")
    void writesNeedLoginButReadsDoNot() throws Exception {
        long postId = postId(writePost(alice, "읽기는 누구나"));
        long commentId = commentId(writeComment(bob, postId, "댓글", null));
        String body = "{\"body\":\"x\"}";
        for (MockHttpServletRequestBuilder request : List.of(post(POSTS), patch("/api/posts/" + postId),
                post("/api/posts/" + postId + "/comments"), patch("/api/comments/" + commentId))) {
            mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("AUTH_UNAUTHORIZED"));
        }
        for (MockHttpServletRequestBuilder request : List.of(delete("/api/posts/" + postId),
                put("/api/posts/" + postId + "/like"), delete("/api/posts/" + postId + "/like"),
                delete("/api/comments/" + commentId), put("/api/comments/" + commentId + "/like"))) {
            mvc.perform(request).andExpect(status().isUnauthorized());
        }

        mvc.perform(get(POSTS)).andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/api/posts/" + postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.post.body").value("읽기는 누구나"))
                .andExpect(jsonPath("$.comments[0].body").value("댓글"));
    }

    @Test
    @DisplayName("잘못된 토큰으로 읽으면 401이다")
    void invalidTokenOnReadIsUnauthorized() throws Exception {
        mvc.perform(get(POSTS).header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("닉네임을 정하지 않으면 글·댓글을 쓸 수 없다(409 COMMUNITY_NICKNAME_REQUIRED)")
    void nicknameRequiredToWrite() throws Exception {
        String noNickname = signIn("carol@example.com", null);
        long postId = postId(writePost(alice, "글"));
        writePost(noNickname, "닉네임 없음")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_NICKNAME_REQUIRED"));
        writeComment(noNickname, postId, "닉네임 없음", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_NICKNAME_REQUIRED"));
    }

    @Test
    @DisplayName("없는 기업은 404, 고유번호 형식이 틀리면 400, 정렬·쪽 크기 범위 밖은 400이다")
    void validatesCompanyAndQuery() throws Exception {
        mvc.perform(get("/api/companies/99999999/posts"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMPANY_NOT_FOUND"));
        mvc.perform(get("/api/companies/abc/posts"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("corpCode"));
        mvc.perform(get(POSTS).param("sort", "oldest"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("sort"));
        mvc.perform(get(POSTS).param("size", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("size"));
        mvc.perform(get(POSTS).param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("page"));
    }

    @Test
    @DisplayName("다른 사람의 글·댓글을 고치거나 지우면 403 COMMUNITY_FORBIDDEN이고 바뀌지 않는다")
    void othersCannotEditOrDelete() throws Exception {
        long postId = postId(writePost(alice, "앨리스의 글"));
        long commentId = commentId(writeComment(alice, postId, "앨리스의 댓글", null));

        mvc.perform(withToken(patch("/api/posts/" + postId), bob).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"바꿈\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("COMMUNITY_FORBIDDEN"));
        mvc.perform(withToken(delete("/api/posts/" + postId), bob)).andExpect(status().isForbidden());
        mvc.perform(withToken(patch("/api/comments/" + commentId), bob).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"바꿈\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("COMMUNITY_FORBIDDEN"));
        mvc.perform(withToken(delete("/api/comments/" + commentId), bob)).andExpect(status().isForbidden());

        mvc.perform(get("/api/posts/" + postId))
                .andExpect(jsonPath("$.post.state").value("VISIBLE"))
                .andExpect(jsonPath("$.post.body").value("앨리스의 글"))
                .andExpect(jsonPath("$.comments[0].state").value("VISIBLE"))
                .andExpect(jsonPath("$.comments[0].body").value("앨리스의 댓글"));
    }

    @Test
    @DisplayName("본인은 글·댓글을 고칠 수 있고 고친 시각이 남는다")
    void ownerEdits() throws Exception {
        long postId = postId(writePost(alice, "처음 글"));
        long commentId = commentId(writeComment(alice, postId, "처음 댓글", null));
        mvc.perform(withToken(patch("/api/posts/" + postId), alice).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"고친 글\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("고친 글"))
                .andExpect(jsonPath("$.editedAt").isString());
        mvc.perform(withToken(patch("/api/comments/" + commentId), alice).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"고친 댓글\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("고친 댓글"))
                .andExpect(jsonPath("$.editedAt").isString())
                .andExpect(jsonPath("$.replies", hasSize(0)));
    }

    @Test
    @DisplayName("댓글이 있는 글을 지우면 '삭제된 글'로 남고 댓글은 그대로, 댓글이 없으면 목록에서 빠지고 404다")
    void deletedPostStaysOnlyWithComments() throws Exception {
        long withComment = postId(writePost(alice, "댓글 있는 글"));
        writeComment(bob, withComment, "남는 댓글", null);
        long alone = postId(writePost(alice, "댓글 없는 글"));

        mvc.perform(withToken(delete("/api/posts/" + withComment), alice)).andExpect(status().isNoContent());
        mvc.perform(withToken(delete("/api/posts/" + withComment), alice)).andExpect(status().isNoContent());
        mvc.perform(withToken(delete("/api/posts/" + alone), alice)).andExpect(status().isNoContent());

        mvc.perform(get(POSTS))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].postId").value(withComment))
                .andExpect(jsonPath("$.items[0].state").value("DELETED"))
                .andExpect(jsonPath("$.items[0].body").isEmpty())
                .andExpect(jsonPath("$.items[0].commentCount").value(1));
        mvc.perform(get("/api/posts/" + withComment))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.post.state").value("DELETED"))
                .andExpect(jsonPath("$.comments[0].body").value("남는 댓글"));
        mvc.perform(get("/api/posts/" + alone))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMUNITY_POST_NOT_FOUND"));

        writeComment(bob, withComment, "지운 글에 댓글", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_TARGET_UNAVAILABLE"));
        mvc.perform(withToken(put("/api/posts/" + withComment + "/like"), bob))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMUNITY_TARGET_UNAVAILABLE"));
    }

    @Test
    @DisplayName("한 쪽은 20개이고, 최신순은 쓴 시각 역순, 인기순은 좋아요+댓글 수(같으면 최신)이다")
    void pagingAndSorting() throws Exception {
        List<Long> ids = new ArrayList<>();
        for (int i = 1; i <= 25; i++) ids.add(postId(writePost(alice, "글 " + i)));

        mvc.perform(get(POSTS))
                .andExpect(jsonPath("$.totalItems").value(25))
                .andExpect(jsonPath("$.items", hasSize(20)))
                .andExpect(jsonPath("$.items[0].body").value("글 25"));
        mvc.perform(get(POSTS).param("page", "1"))
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[4].body").value("글 1"));

        // 글 3: 좋아요 2 + 댓글 1, 글 5: 좋아요 3, 글 4: 좋아요 3(글 5보다 먼저 씀) → 5, 4, 3, 그다음은 최신순
        jdbc.update("UPDATE community_post SET like_count = 2, comment_count = 1 WHERE id = ?", ids.get(2));
        jdbc.update("UPDATE community_post SET like_count = 3 WHERE id IN (?, ?)", ids.get(3), ids.get(4));
        mvc.perform(get(POSTS).param("sort", "popular").param("size", "4"))
                .andExpect(jsonPath("$.sort").value("popular"))
                .andExpect(jsonPath("$.items[0].body").value("글 5"))
                .andExpect(jsonPath("$.items[1].body").value("글 4"))
                .andExpect(jsonPath("$.items[2].body").value("글 3"))
                .andExpect(jsonPath("$.items[3].body").value("글 25"));
    }

    @Test
    @DisplayName("답글은 한 단계만이고(두 단계째와 다른 글의 댓글은 400), 댓글은 1~500자다")
    void repliesAreOneLevel() throws Exception {
        long postId = postId(writePost(alice, "글"));
        long otherPostId = postId(writePost(alice, "다른 글"));
        long commentId = commentId(writeComment(bob, postId, "댓글", null));
        long replyId = commentId(writeComment(alice, postId, "  답글  ", commentId)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.parentId").value(commentId))
                .andExpect(jsonPath("$.body").value("답글"))
                .andExpect(jsonPath("$.replies", hasSize(0))));

        writeComment(bob, postId, "답글의 답글", replyId)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("parentId"));
        writeComment(bob, otherPostId, "다른 글의 댓글에 답글", commentId)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("parentId"));
        writeComment(bob, postId, "없는 댓글에 답글", 999_999L)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("parentId"));
        writeComment(bob, postId, "가".repeat(501), null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("body"));
        writeComment(bob, postId, " ", null).andExpect(status().isBadRequest());
        writeComment(bob, postId, "가".repeat(500), null).andExpect(status().isCreated());

        mvc.perform(get("/api/posts/" + postId))
                .andExpect(jsonPath("$.post.commentCount").value(3))
                .andExpect(jsonPath("$.comments", hasSize(2)))
                .andExpect(jsonPath("$.comments[0].commentId").value(commentId))
                .andExpect(jsonPath("$.comments[0].author.nickname").value("Chip2026"))
                .andExpect(jsonPath("$.comments[0].replies", hasSize(1)))
                .andExpect(jsonPath("$.comments[0].replies[0].commentId").value(replyId))
                .andExpect(jsonPath("$.comments[0].replies[0].author.nickname").value("반도체공부중"));
    }

    @Test
    @DisplayName("지운 댓글은 지우지 않은 답글이 있을 때만 '삭제된 댓글'로 남고, 글의 댓글 수에서 빠진다")
    void deletedCommentStaysOnlyWithReplies() throws Exception {
        long postId = postId(writePost(alice, "글"));
        long withReply = commentId(writeComment(bob, postId, "답글 있는 댓글", null));
        long replyId = commentId(writeComment(alice, postId, "답글", withReply));
        long alone = commentId(writeComment(bob, postId, "답글 없는 댓글", null));

        mvc.perform(withToken(delete("/api/comments/" + withReply), bob)).andExpect(status().isNoContent());
        mvc.perform(withToken(delete("/api/comments/" + withReply), bob)).andExpect(status().isNoContent());
        mvc.perform(withToken(delete("/api/comments/" + alone), bob)).andExpect(status().isNoContent());

        mvc.perform(get("/api/posts/" + postId))
                .andExpect(jsonPath("$.post.commentCount").value(1))
                .andExpect(jsonPath("$.comments", hasSize(1)))
                .andExpect(jsonPath("$.comments[0].commentId").value(withReply))
                .andExpect(jsonPath("$.comments[0].state").value("DELETED"))
                .andExpect(jsonPath("$.comments[0].body").isEmpty())
                .andExpect(jsonPath("$.comments[0].replies[0].body").value("답글"));

        mvc.perform(withToken(delete("/api/comments/" + replyId), alice)).andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/" + postId))
                .andExpect(jsonPath("$.post.commentCount").value(0))
                .andExpect(jsonPath("$.comments", hasSize(0)));
        mvc.perform(withToken(patch("/api/comments/" + alone), bob).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"고침\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMUNITY_COMMENT_NOT_FOUND"));
    }

    @Test
    @DisplayName("좋아요는 한 사람 한 번이고, 취소하면 빠지고, 다시 눌러도 더해지지 않는다")
    void likeOncePerUser() throws Exception {
        long postId = postId(writePost(alice, "글"));
        long commentId = commentId(writeComment(alice, postId, "댓글", null));

        like("/api/posts/" + postId, bob).andExpect(jsonPath("$.liked").value(true))
                .andExpect(jsonPath("$.likeCount").value(1));
        like("/api/posts/" + postId, bob).andExpect(jsonPath("$.likeCount").value(1));
        like("/api/posts/" + postId, alice).andExpect(jsonPath("$.likeCount").value(2));
        mvc.perform(withToken(get(POSTS), bob))
                .andExpect(jsonPath("$.items[0].liked").value(true))
                .andExpect(jsonPath("$.items[0].likeCount").value(2));
        mvc.perform(withToken(delete("/api/posts/" + postId + "/like"), bob))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.liked").value(false))
                .andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(withToken(delete("/api/posts/" + postId + "/like"), bob))
                .andExpect(jsonPath("$.likeCount").value(1));

        like("/api/comments/" + commentId, bob).andExpect(jsonPath("$.likeCount").value(1));
        like("/api/comments/" + commentId, bob).andExpect(jsonPath("$.likeCount").value(1));
        mvc.perform(withToken(get("/api/posts/" + postId), bob))
                .andExpect(jsonPath("$.post.liked").value(false))
                .andExpect(jsonPath("$.comments[0].liked").value(true))
                .andExpect(jsonPath("$.comments[0].likeCount").value(1));
        mvc.perform(get("/api/posts/999999/like").header("Authorization", "Bearer " + bob))
                .andExpect(status().isMethodNotAllowed());
        like("/api/posts/999999", bob).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMUNITY_POST_NOT_FOUND"));
    }

    @Test
    @DisplayName("같은 사람이 동시에 여러 번 눌러도 좋아요는 한 번만 더해진다")
    void concurrentLikesCountOnce() throws Exception {
        long postId = postId(writePost(alice, "글"));
        ExecutorService pool = Executors.newFixedThreadPool(4);
        try {
            List<Callable<Integer>> tasks = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                tasks.add(() -> like("/api/posts/" + postId, bob).andReturn().getResponse().getStatus());
            }
            for (Future<Integer> result : pool.invokeAll(tasks)) assertThat(result.get()).isEqualTo(200);
        } finally {
            pool.shutdown();
        }
        assertThat(count("community_like")).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT like_count FROM community_post WHERE id = ?", Integer.class, postId))
                .isEqualTo(1);
    }

    private ResultActions like(String target, String token) throws Exception {
        return mvc.perform(withToken(put(target + "/like"), token));
    }

    private ResultActions writePost(String token, String body) throws Exception {
        return mvc.perform(withToken(post(POSTS), token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\":\"" + body + "\"}"));
    }

    private ResultActions writeComment(String token, long postId, String body, Long parentId) throws Exception {
        return mvc.perform(withToken(post("/api/posts/" + postId + "/comments"), token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\":\"" + body + "\",\"parentId\":" + parentId + "}"));
    }

    private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder request, String token) {
        return request.header("Authorization", "Bearer " + token);
    }

    private static long postId(ResultActions result) throws Exception {
        return ((Number) JsonPath.read(result.andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString(), "$.postId")).longValue();
    }

    private static long commentId(ResultActions result) throws Exception {
        return ((Number) JsonPath.read(result.andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString(), "$.commentId")).longValue();
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    /** 가입·로그인하고 닉네임을 정한다(nickname이 null이면 정하지 않음). Access Token을 돌려준다 */
    private String signIn(String email, String nickname) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        String login = mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(login, "$.accessToken");
        if (nickname != null) {
            mvc.perform(withToken(put("/api/users/current/nickname"), token).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"nickname\":\"" + nickname + "\"}")).andExpect(status().isOk());
        }
        return token;
    }
}
