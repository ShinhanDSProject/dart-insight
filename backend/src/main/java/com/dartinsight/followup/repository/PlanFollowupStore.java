package com.dartinsight.followup.repository;

import com.dartinsight.followup.domain.PlanFollowupItem;
import com.dartinsight.followup.domain.PlanFollowupRecord;
import com.dartinsight.followup.domain.PlanFollowupStatus;
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
 * 약속과 실제 대조(plan_followup)와 그 LLM 호출 기록(llm_call, task plan_followup) 저장. 한 트랜잭션에서 부른다.
 * 계획·올해 문단·근거 위치는 JSON 배열 하나로 저장한다(docs/erd.md).
 */
@Repository
@RequiredArgsConstructor
public class PlanFollowupStore {

    private static final String SELECT = "SELECT id, previous_rcept_no, current_rcept_no, prompt_version, status, "
            + "items, review_reason, blocked_rules, model, generated_at, trace_id, created_at FROM plan_followup ";

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public Optional<PlanFollowupRecord> find(String previousRceptNo, String currentRceptNo, String promptVersion) {
        return jdbcTemplate.query(SELECT + "WHERE previous_rcept_no = ? AND current_rcept_no = ? "
                + "AND prompt_version = ?", this::map, previousRceptNo, currentRceptNo, promptVersion).stream()
                .findFirst();
    }

    /** 결과와 호출 기록을 저장하고 id를 돌려준다. 같은 두 보고서·프롬프트 버전이 이미 있으면 UNIQUE 위반 */
    public long save(PlanFollowupRecord row, List<LlmCallRow> calls) {
        String items = jsonMapper.writeValueAsString(row.items());
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO plan_followup (previous_rcept_no, "
                    + "current_rcept_no, prompt_version, status, items, review_reason, blocked_rules, model, "
                    + "generated_at, trace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    new String[] {"id"});
            ps.setString(1, row.previousRceptNo());
            ps.setString(2, row.currentRceptNo());
            ps.setString(3, row.promptVersion());
            ps.setString(4, row.status().name());
            ps.setString(5, items);
            ps.setString(6, limit(row.reviewReason(), 500));
            ps.setString(7, row.blockedRules().isEmpty() ? null : limit(String.join(",", row.blockedRules()), 200));
            ps.setString(8, limit(row.model(), 100));
            ps.setTimestamp(9, timestamp(row.generatedAt()));
            ps.setString(10, limit(row.traceId(), 64));
            ps.setTimestamp(11, timestamp(row.createdAt()));
            return ps;
        }, keys);
        long id = Objects.requireNonNull(keys.getKey(), "plan_followup id").longValue();

        List<Object[]> callRows = new ArrayList<>();
        for (LlmCallRow call : calls) {
            callRows.add(new Object[] {id, limit(call.task(), 30), limit(call.provider(), 30),
                    limit(call.model(), 100), limit(call.promptVersion(), 30), timestamp(call.calledAt()),
                    limit(call.traceId(), 64), call.inputTokens(), call.outputTokens(), call.latencyMs(),
                    call.attempt(), limit(call.outcome(), 20), limit(call.error(), 500)});
        }
        if (!callRows.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO llm_call (plan_followup_id, task, provider, model, "
                    + "prompt_version, called_at, trace_id, input_tokens, output_tokens, latency_ms, attempt, outcome, "
                    + "error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", callRows);
        }
        return id;
    }

    private PlanFollowupRecord map(ResultSet rs, int rowNum) throws SQLException {
        String blocked = rs.getString("blocked_rules");
        return new PlanFollowupRecord(rs.getLong("id"), rs.getString("previous_rcept_no"),
                rs.getString("current_rcept_no"), rs.getString("prompt_version"),
                PlanFollowupStatus.valueOf(rs.getString("status")),
                List.of(jsonMapper.readValue(rs.getString("items"), PlanFollowupItem[].class)),
                rs.getString("review_reason"),
                blocked == null || blocked.isEmpty() ? List.of() : Arrays.asList(blocked.split(",")),
                rs.getString("model"), time(rs.getTimestamp("generated_at")), rs.getString("trace_id"),
                time(rs.getTimestamp("created_at")));
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
