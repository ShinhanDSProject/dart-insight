package com.dartinsight.explanation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.jayway.jsonpath.JsonPath;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;

/**
 * 문장 변경 한 줄 풀이의 하루 한도(ADR-0069). 비로그인 한도를 1로 두어, AI 서버로 새로 만들 때만 세고
 * 저장된 풀이·요약 문장·원문 없음은 세지 않음을 본다.
 */
@SpringBootTest(properties = {
        "app.llm-quota.enabled=true",
        "app.llm-quota.explanation-anonymous-per-day=1",
        "app.llm-quota.explanation-member-per-day=5",
        "app.llm-quota.explanation-total-per-day=100"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ExplanationQuotaApiTest extends ExplanationApiFixture {

    private static final String IP = "7.7.7.7";

    @BeforeEach
    void answerWithSentence() {
        AI.on(SUMMARIES, request -> {
            String ref = JsonPath.<String>read(request.bodyText(), "$.textItems[0].ref");
            return Reply.ok(summaryReply("""
                    {"ref":"%s","kind":"TEXT","status":"OK","sentence":"현재 보고서에 종속회사의 과징금 납부 사실이 적혔어요.",
                     "evidenceIds":["%s#B3"],"reviewReason":null,"blockedRules":[]}""".formatted(ref, CUR)));
        });
    }

    @Test
    @DisplayName("새로 만들 때만 세서, 한도를 다 쓴 뒤에도 저장된 풀이·요약 문장·원문 없음은 그대로 받는다")
    void countsOnlyNewGeneration() throws Exception {
        explainFrom(IP, analysisId, changeId(MODIFIED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cached").value(false));

        explainFrom(IP, analysisId, changeId(MODIFIED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cached").value(true));
        explainFrom(IP, analysisId, changeId(SUMMARIZED)).andExpect(status().isOk());
        explainFrom(IP, analysisId, changeId(UNMATCHED)).andExpect(status().isOk());
        assertThat(AI.requests(SUMMARIES)).hasSize(1);
    }

    @Test
    @DisplayName("한도를 넘으면 AI 서버를 부르지 않고 429와 Retry-After를 주며, 다른 IP는 막히지 않는다")
    void blocksNewGenerationOverLimit() throws Exception {
        explainFrom(IP, analysisId, changeId(MODIFIED)).andExpect(status().isOk());
        // 같은 변경을 다시 만들어야 하는 상태로 되돌린다(하루 횟수는 그대로)
        jdbcTemplate.update("DELETE FROM text_change_explanation");

        explainFrom(IP, analysisId, changeId(MODIFIED))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("AI_QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.message").value(Matchers.containsString("AI 한 줄 풀이")))
                .andExpect(jsonPath("$.message").value(Matchers.containsString("로그인하면 더 쓸 수 있어요")))
                .andExpect(header().string("Retry-After", Matchers.matchesPattern("[1-9][0-9]*")));
        assertThat(AI.requests(SUMMARIES)).hasSize(1);
        assertThat(explanationRows()).isZero();

        explainFrom("8.8.8.8", analysisId, changeId(MODIFIED)).andExpect(status().isOk());
        assertThat(AI.requests(SUMMARIES)).hasSize(2);
    }
}
