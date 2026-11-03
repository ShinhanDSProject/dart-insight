package com.dartinsight.agent.repository;

import com.dartinsight.summary.domain.LlmCallRow;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 에이전트 채팅의 LLM 호출 기록(llm_call, task agent_plan·agent_answer). 대화는 저장하지 않으므로 분석 ID만 채운다
 * (docs/erd.md llm_call). 채팅 안의 근거 질문 호출은 질문 기록과 함께 질문 쪽이 저장한다.
 */
@Repository
@RequiredArgsConstructor
public class AgentCallStore {

    private final JdbcTemplate jdbcTemplate;

    public void save(long analysisId, List<LlmCallRow> calls) {
        List<Object[]> rows = new ArrayList<>();
        for (LlmCallRow call : calls) {
            rows.add(new Object[] {analysisId, limit(call.task(), 30), limit(call.provider(), 30),
                    limit(call.model(), 100), limit(call.promptVersion(), 30), timestamp(call.calledAt()),
                    limit(call.traceId(), 64), call.inputTokens(), call.outputTokens(), call.latencyMs(),
                    call.attempt(), limit(call.outcome(), 20), limit(call.error(), 500)});
        }
        if (!rows.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO llm_call (analysis_id, task, provider, model, prompt_version, "
                    + "called_at, trace_id, input_tokens, output_tokens, latency_ms, attempt, outcome, error) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows);
        }
    }

    private static Timestamp timestamp(LocalDateTime value) {
        return value == null ? null : Timestamp.valueOf(value);
    }

    private static String limit(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
