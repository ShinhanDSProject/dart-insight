package com.dartinsight.explanation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dartinsight.aiserver.client.FakeAiServer.Reply;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/** 문장 변경 AI 한 줄 풀이(3.11): POST /api/analyses/{analysisId}/text-changes/{changeId}/explanations */
@SpringBootTest
class ExplanationApiTest extends ExplanationApiFixture {

    @Test
    @DisplayName("처음엔 AI 서버로 만들어 저장하고, 두 번째는 AI 서버를 부르지 않고 cached true")
    void generatesOnceThenReturnsCached() throws Exception {
        AI.on(SUMMARIES, request -> {
            String ref = JsonPath.<String>read(request.bodyText(), "$.textItems[0].ref");
            return Reply.ok(summaryReply("""
                    {"ref":"%s","kind":"TEXT","status":"OK","sentence":"현재 보고서에 종속회사의 과징금 납부 사실이 적혔어요.",
                     "evidenceIds":["%s#B3","%s#B3"],"reviewReason":null,"blockedRules":[]}""".formatted(ref, CUR,
                    PREV)));
        });
        Long changeId = changeId(MODIFIED);

        explain(analysisId, changeId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.changeId").value(changeId))
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.sentence").value("현재 보고서에 종속회사의 과징금 납부 사실이 적혔어요."))
                .andExpect(jsonPath("$.message").doesNotExist())
                .andExpect(jsonPath("$.evidence", hasSize(2)))
                .andExpect(jsonPath("$.evidence[0].side").value("current"))
                .andExpect(jsonPath("$.evidence[0].rceptNo").value(CUR))
                .andExpect(jsonPath("$.evidence[0].sectionNo").value(3))
                .andExpect(jsonPath("$.evidence[0].blockNo").value(3))
                .andExpect(jsonPath("$.evidence[0].sectionPath").value("II. 사업의 내용 > 7. 기타 참고사항"))
                .andExpect(jsonPath("$.evidence[0].evidenceId").value(CUR + "#B3"))
                .andExpect(jsonPath("$.evidence[1].side").value("previous"))
                .andExpect(jsonPath("$.evidence[1].rceptNo").value(PREV))
                .andExpect(jsonPath("$.evidence[1].sectionNo").value(3))
                .andExpect(jsonPath("$.evidence[1].blockNo").value(3))
                .andExpect(jsonPath("$.evidence[1].sectionPath").value("II. 사업의 내용 > 7. 기타 사항"))
                .andExpect(jsonPath("$.evidence[1].evidenceId").value(PREV + "#B3"))
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.ai.model").value("fake-model"))
                .andExpect(jsonPath("$.ai.promptVersion").value("summary-2"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-25T09:40:11"))
                .andExpect(jsonPath("$.cached").value(false));

        // 보낸 것: 문장 항목 하나(두 보고서 원문), 재무 항목은 빈 목록
        String sent = AI.requests(SUMMARIES).getFirst().bodyText();
        assertThat(JsonPath.<String>read(sent, "$.companyName")).isEqualTo("예시전자");
        assertThat(JsonPath.<List<Object>>read(sent, "$.textItems")).hasSize(1);
        assertThat(JsonPath.<List<Object>>read(sent, "$.financialItems")).isEmpty();
        assertThat(JsonPath.<List<String>>read(sent, "$.textItems[0].sources[*].evidenceId"))
                .containsExactly(PREV + "#B3", CUR + "#B3");

        explain(analysisId, changeId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.sentence").value("현재 보고서에 종속회사의 과징금 납부 사실이 적혔어요."))
                .andExpect(jsonPath("$.evidence[0].evidenceId").value(CUR + "#B3"))
                .andExpect(jsonPath("$.evidence[1].sectionPath").value("II. 사업의 내용 > 7. 기타 사항"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-25T09:40:11"))
                .andExpect(jsonPath("$.cached").value(true));
        assertThat(AI.requests(SUMMARIES)).hasSize(1);

        Map<String, Object> stored = jdbcTemplate.queryForMap("SELECT * FROM text_change_explanation");
        assertThat(stored.get("change_no")).isEqualTo(MODIFIED);
        assertThat(stored.get("status")).isEqualTo("OK");
        assertThat(stored.get("evidence_ids")).isEqualTo(CUR + "#B3," + PREV + "#B3");
        assertThat(stored.get("model")).isEqualTo("fake-model");
        assertThat(stored.get("trace_id")).isNotNull();
        Map<String, Object> call = jdbcTemplate.queryForMap("SELECT * FROM llm_call");
        assertThat(call.get("analysis_id")).isEqualTo(analysisId);
        assertThat(call.get("trace_id")).isEqualTo("trace-x1");
    }

    @Test
    @DisplayName("요약에 그 변경의 AI 문장이 있으면 AI 서버 없이 그 문장을 저장해 돌려준다")
    void reusesSummarySentenceWithoutAiServer() throws Exception {
        explain(analysisId, changeId(SUMMARIZED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.sentence").value("현재 보고서에 새 공장 소식이 적혔어요."))
                .andExpect(jsonPath("$.evidence[0].evidenceId").value(CUR + "#B2"))
                .andExpect(jsonPath("$.evidence[0].sectionNo").value(3))
                .andExpect(jsonPath("$.evidence[0].blockNo").value(2))
                .andExpect(jsonPath("$.evidence[0].sectionPath").value("II. 사업의 내용 > 7. 기타 참고사항"))
                .andExpect(jsonPath("$.ai.model").value("summary-model"))
                .andExpect(jsonPath("$.ai.promptVersion").value("summary-2"))
                .andExpect(jsonPath("$.ai.generatedAt").value("2026-10-24T08:00:00"))
                .andExpect(jsonPath("$.cached").value(false));
        assertThat(AI.requests(SUMMARIES)).isEmpty();
        assertThat(explanationRows()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM llm_call", Integer.class)).isZero();
    }

    @Test
    @DisplayName("짝을 찾지 못해 원문이 없는 변경은 AI 서버 없이 NO_SOURCE로 저장한다")
    void unmatchedChangeHasNoSourceWithoutAiServer() throws Exception {
        Long changeId = changeId(UNMATCHED);
        explain(analysisId, changeId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_SOURCE"))
                .andExpect(jsonPath("$.sentence").doesNotExist())
                .andExpect(jsonPath("$.message").value("두 보고서에서 이 변경의 원문을 짝짓지 못해 풀이할 수 없어요."))
                .andExpect(jsonPath("$.evidence", hasSize(0)))
                .andExpect(jsonPath("$.aiGenerated").value(false))
                .andExpect(jsonPath("$.ai").doesNotExist())
                .andExpect(jsonPath("$.cached").value(false));
        explain(analysisId, changeId)
                .andExpect(jsonPath("$.status").value("NO_SOURCE"))
                .andExpect(jsonPath("$.cached").value(true));
        assertThat(AI.requests(SUMMARIES)).isEmpty();
        assertThat(explanationRows()).isEqualTo(1);
    }

    @Test
    @DisplayName("보내지 않은 원문을 근거로 든 풀이는 쓰지 않고 REVIEW_NEEDED, AI 서버의 검토 필요는 사유와 규칙을 남긴다")
    void failedValidationNeedsReview() throws Exception {
        AI.on(SUMMARIES, request -> {
            String ref = JsonPath.<String>read(request.bodyText(), "$.textItems[0].ref");
            return Reply.ok(summaryReply("""
                    {"ref":"%s","kind":"TEXT","status":"OK","sentence":"다른 보고서 내용",
                     "evidenceIds":["%s#B99"],"reviewReason":null,"blockedRules":[]}""".formatted(ref, CUR)));
        });
        explain(analysisId, changeId(MODIFIED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.sentence").doesNotExist())
                .andExpect(jsonPath("$.message").value("요약 문장의 근거가 보낸 원문 위치가 아니라 쓰지 않았어요."))
                .andExpect(jsonPath("$.evidence", hasSize(0)))
                .andExpect(jsonPath("$.ai").doesNotExist())
                .andExpect(jsonPath("$.cached").value(false));

        setUp();
        AI.on(SUMMARIES, request -> {
            String ref = JsonPath.<String>read(request.bodyText(), "$.textItems[0].ref");
            return Reply.ok(summaryReply("""
                    {"ref":"%s","kind":"TEXT","status":"REVIEW_NEEDED","sentence":null,"evidenceIds":[],
                     "reviewReason":"투자 권유로 읽힐 수 있는 표현이 있어요.","blockedRules":["EXPR-BUY"]}"""
                    .formatted(ref)));
        });
        explain(analysisId, changeId(MODIFIED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"))
                .andExpect(jsonPath("$.message").value("투자 권유로 읽힐 수 있는 표현이 있어요."));
        Map<String, Object> stored = jdbcTemplate.queryForMap("SELECT * FROM text_change_explanation");
        assertThat(stored.get("status")).isEqualTo("REVIEW_NEEDED");
        assertThat(stored.get("blocked_rules")).isEqualTo("EXPR-BUY");
        assertThat(stored.get("sentence")).isNull();
    }

    @Test
    @DisplayName("없는 분석·이 분석의 변경이 아니면 404, 끝나지 않은 분석은 409")
    void unknownIsNotFoundAndUnfinishedIsNotReady() throws Exception {
        explain(999_999L, changeId(MODIFIED))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_FOUND"));
        explain(analysisId, 999_999L)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANALYSIS_TEXT_CHANGE_NOT_FOUND"));

        Long running = analysisRepository.save(
                Analysis.request("00000001", CUR, PREV, ComparisonBasis.PREV, null, NOW)).getId();
        explain(running, changeId(MODIFIED))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_NOT_READY"));
        assertThat(AI.requests(SUMMARIES)).isEmpty();
        assertThat(explanationRows()).isZero();
    }

    @Test
    @DisplayName("AI 서버나 LLM을 쓸 수 없으면 503 AI_SERVER_UNAVAILABLE이고 저장하지 않는다")
    void aiServerFailureIsServiceUnavailable() throws Exception {
        AI.on(SUMMARIES, Reply.error(503, "AI_LLM_UNAVAILABLE", "LLM을 쓸 수 없어요."));

        explain(analysisId, changeId(MODIFIED))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVER_UNAVAILABLE"));
        assertThat(explanationRows()).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM llm_call", Integer.class)).isZero();
    }
}
