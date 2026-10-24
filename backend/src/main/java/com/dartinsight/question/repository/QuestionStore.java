package com.dartinsight.question.repository;

import com.dartinsight.question.domain.QuestionRecord;
import com.dartinsight.question.domain.QuestionStatus;
import com.dartinsight.summary.domain.LlmCallRow;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/** 질문·답(analysis_question)과 그 LLM 호출 기록(llm_call, task answer) 저장. 한 트랜잭션에서 부른다. */
@Repository
@RequiredArgsConstructor
public class QuestionStore {

    private final JdbcTemplate jdbcTemplate;

    /** 질문을 저장하고 id를 돌려준다 */
    public long save(QuestionRecord row, List<LlmCallRow> calls) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO analysis_question (analysis_id, question, "
                    + "status, answer, evidence_ids, fact_change_ids, review_reason, blocked_rules, model, "
                    + "prompt_version, generated_at, trace_id, created_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setLong(1, row.analysisId());
            ps.setString(2, limit(row.question(), 400));
            ps.setString(3, row.status().name());
            ps.setString(4, limit(row.answer(), 1000));
            ps.setString(5, joined(row.evidenceIds(), 2000));
            ps.setString(6, joined(row.factChangeIds().stream().map(String::valueOf).toList(), 500));
            ps.setString(7, limit(row.reviewReason(), 500));
            ps.setString(8, joined(row.blockedRules(), 200));
            ps.setString(9, limit(row.model(), 100));
            ps.setString(10, limit(row.promptVersion(), 30));
            ps.setTimestamp(11, timestamp(row.generatedAt()));
            ps.setString(12, limit(row.traceId(), 64));
            ps.setTimestamp(13, timestamp(row.createdAt()));
            return ps;
        }, keys);
        long id = Objects.requireNonNull(keys.getKey(), "analysis_question id").longValue();

        List<Object[]> callRows = new ArrayList<>();
        for (LlmCallRow call : calls) {
            callRows.add(new Object[] {row.analysisId(), limit(call.task(), 30), limit(call.provider(), 30),
                    limit(call.model(), 100), limit(call.promptVersion(), 30), timestamp(call.calledAt()),
                    limit(call.traceId(), 64), call.inputTokens(), call.outputTokens(), call.latencyMs(),
                    call.attempt(), limit(call.outcome(), 20), limit(call.error(), 500)});
        }
        if (!callRows.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO llm_call (analysis_id, task, provider, model, prompt_version, "
                    + "called_at, trace_id, input_tokens, output_tokens, latency_ms, attempt, outcome, error) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", callRows);
        }
        return id;
    }

    /** 이 분석의 질문, 최신 순으로 limit개 */
    public List<QuestionRecord> latest(long analysisId, int limit) {
        return jdbcTemplate.query("SELECT id, analysis_id, question, status, answer, evidence_ids, fact_change_ids, "
                + "review_reason, blocked_rules, model, prompt_version, generated_at, trace_id, created_at "
                + "FROM analysis_question WHERE analysis_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
                QuestionStore::map, analysisId, limit);
    }

    private static QuestionRecord map(ResultSet rs, int rowNum) throws SQLException {
        return new QuestionRecord(rs.getLong("id"), rs.getLong("analysis_id"), rs.getString("question"),
                QuestionStatus.valueOf(rs.getString("status")), rs.getString("answer"),
                split(rs.getString("evidence_ids")),
                split(rs.getString("fact_change_ids")).stream().map(Long::valueOf).toList(),
                rs.getString("review_reason"), split(rs.getString("blocked_rules")), rs.getString("model"),
                rs.getString("prompt_version"), time(rs.getTimestamp("generated_at")), rs.getString("trace_id"),
                time(rs.getTimestamp("created_at")));
    }

    private static List<String> split(String joined) {
        return joined == null || joined.isEmpty() ? List.of() : Arrays.asList(joined.split(","));
    }

    private static String joined(List<String> values, int max) {
        return values == null || values.isEmpty() ? null : limit(String.join(",", values), max);
    }

    private static Timestamp timestamp(LocalDateTime value) {
        return value == null ? null : Timestamp.valueOf(value);
    }

    private static LocalDateTime time(Timestamp value) {
        return value == null ? null : value.toLocalDateTime();
    }

    private static String limit(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
