package com.dartinsight.explanation.repository;

import com.dartinsight.explanation.domain.ExplanationStatus;
import com.dartinsight.explanation.domain.TextExplanationRecord;
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
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/** 문장 변경 한 줄 풀이(text_change_explanation)와 그 LLM 호출 기록(llm_call) 저장. 한 트랜잭션에서 부른다. */
@Repository
@RequiredArgsConstructor
public class ExplanationStore {

    private final JdbcTemplate jdbcTemplate;

    public Optional<TextExplanationRecord> find(long analysisId, int changeNo) {
        return jdbcTemplate.query("SELECT id, analysis_id, change_no, status, sentence, evidence_ids, review_reason, "
                + "blocked_rules, model, prompt_version, generated_at, trace_id, created_at "
                + "FROM text_change_explanation WHERE analysis_id = ? AND change_no = ?",
                ExplanationStore::map, analysisId, changeNo).stream().findFirst();
    }

    /** 풀이를 저장하고 id를 돌려준다. 같은 분석·변경의 풀이가 이미 있으면 DuplicateKeyException */
    public long save(TextExplanationRecord row, List<LlmCallRow> calls) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO text_change_explanation (analysis_id, "
                    + "change_no, status, sentence, evidence_ids, review_reason, blocked_rules, model, "
                    + "prompt_version, generated_at, trace_id, created_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setLong(1, row.analysisId());
            ps.setInt(2, row.changeNo());
            ps.setString(3, row.status().name());
            ps.setString(4, limit(row.sentence(), 1000));
            ps.setString(5, joined(row.evidenceIds(), 500));
            ps.setString(6, limit(row.reviewReason(), 500));
            ps.setString(7, joined(row.blockedRules(), 200));
            ps.setString(8, limit(row.model(), 100));
            ps.setString(9, limit(row.promptVersion(), 30));
            ps.setTimestamp(10, timestamp(row.generatedAt()));
            ps.setString(11, limit(row.traceId(), 64));
            ps.setTimestamp(12, timestamp(row.createdAt()));
            return ps;
        }, keys);
        long id = Objects.requireNonNull(keys.getKey(), "text_change_explanation id").longValue();

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

    private static TextExplanationRecord map(ResultSet rs, int rowNum) throws SQLException {
        return new TextExplanationRecord(rs.getLong("id"), rs.getLong("analysis_id"), rs.getInt("change_no"),
                ExplanationStatus.valueOf(rs.getString("status")), rs.getString("sentence"),
                split(rs.getString("evidence_ids")), rs.getString("review_reason"),
                split(rs.getString("blocked_rules")), rs.getString("model"), rs.getString("prompt_version"),
                time(rs.getTimestamp("generated_at")), rs.getString("trace_id"), time(rs.getTimestamp("created_at")));
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
