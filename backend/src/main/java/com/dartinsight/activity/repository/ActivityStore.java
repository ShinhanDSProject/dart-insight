package com.dartinsight.activity.repository;

import com.dartinsight.activity.domain.ActivityPayload;
import com.dartinsight.activity.domain.ActivityRecord;
import com.dartinsight.activity.domain.ActivityStatus;
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
import tools.jackson.databind.json.JsonMapper;

/**
 * 두 보고서 사이 활동(period_activity)과 그 LLM 호출 기록(llm_call, task period_activity, analysis_id만 채움) 저장.
 * 한 트랜잭션에서 부른다. 요약·카드·근거 위치는 JSON 하나로 저장한다(docs/erd.md).
 */
@Repository
@RequiredArgsConstructor
public class ActivityStore {

    private static final String SELECT = "SELECT id, analysis_id, prompt_version, status, payload, review_reason, "
            + "blocked_rules, signal_table_version, model, generated_at, trace_id, created_at FROM period_activity ";

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public Optional<ActivityRecord> find(Long analysisId, String promptVersion) {
        return jdbcTemplate.query(SELECT + "WHERE analysis_id = ? AND prompt_version = ?", this::map, analysisId,
                promptVersion).stream().findFirst();
    }

    /** 결과와 호출 기록을 저장하고 id를 돌려준다. 같은 분석·프롬프트 버전이 이미 있으면 UNIQUE 위반 */
    public long save(ActivityRecord row, List<LlmCallRow> calls) {
        String payload = jsonMapper.writeValueAsString(row.payload());
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO period_activity (analysis_id, "
                    + "prompt_version, status, payload, review_reason, blocked_rules, signal_table_version, model, "
                    + "generated_at, trace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    new String[] {"id"});
            ps.setLong(1, row.analysisId());
            ps.setString(2, row.promptVersion());
            ps.setString(3, row.status().name());
            ps.setString(4, payload);
            ps.setString(5, limit(row.reviewReason(), 500));
            ps.setString(6, row.blockedRules().isEmpty() ? null : limit(String.join(",", row.blockedRules()), 200));
            ps.setString(7, limit(row.signalTableVersion(), 30));
            ps.setString(8, limit(row.model(), 100));
            ps.setTimestamp(9, timestamp(row.generatedAt()));
            ps.setString(10, limit(row.traceId(), 64));
            ps.setTimestamp(11, timestamp(row.createdAt()));
            return ps;
        }, keys);
        long id = Objects.requireNonNull(keys.getKey(), "period_activity id").longValue();

        List<Object[]> callRows = new ArrayList<>();
        for (LlmCallRow call : calls) {
            callRows.add(new Object[] {row.analysisId(), limit(call.task(), 30), limit(call.provider(), 30),
                    limit(call.model(), 100), limit(call.promptVersion(), 30), timestamp(call.calledAt()),
                    limit(call.traceId(), 64), call.inputTokens(), call.outputTokens(), call.latencyMs(),
                    call.attempt(), limit(call.outcome(), 20), limit(call.error(), 500), call.cachedInputTokens(),
                    call.reasoningTokens()});
        }
        if (!callRows.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO llm_call (analysis_id, task, provider, model, prompt_version, "
                    + "called_at, trace_id, input_tokens, output_tokens, latency_ms, attempt, outcome, error, "
                    + "cached_input_tokens, reasoning_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    callRows);
        }
        return id;
    }

    private ActivityRecord map(ResultSet rs, int rowNum) throws SQLException {
        String blocked = rs.getString("blocked_rules");
        return new ActivityRecord(rs.getLong("id"), rs.getLong("analysis_id"), rs.getString("prompt_version"),
                ActivityStatus.valueOf(rs.getString("status")),
                jsonMapper.readValue(rs.getString("payload"), ActivityPayload.class), rs.getString("review_reason"),
                blocked == null || blocked.isEmpty() ? List.of() : Arrays.asList(blocked.split(",")),
                rs.getString("signal_table_version"), rs.getString("model"), time(rs.getTimestamp("generated_at")),
                rs.getString("trace_id"), time(rs.getTimestamp("created_at")));
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
