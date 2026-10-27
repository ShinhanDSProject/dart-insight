package com.dartinsight.outlook.repository;

import com.dartinsight.outlook.domain.OutlookItem;
import com.dartinsight.outlook.domain.OutlookRecord;
import com.dartinsight.outlook.domain.OutlookStatus;
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
 * 회사가 밝힌 전망·계획(company_outlook)과 그 LLM 호출 기록(llm_call, task outlook) 저장. 한 트랜잭션에서 부른다.
 * 항목과 근거 위치는 JSON 배열 하나로 저장한다(docs/erd.md).
 */
@Repository
@RequiredArgsConstructor
public class OutlookStore {

    private static final String SELECT = "SELECT id, rcept_no, prompt_version, status, items, review_reason, "
            + "blocked_rules, model, generated_at, trace_id, created_at FROM company_outlook ";

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public Optional<OutlookRecord> find(String rceptNo, String promptVersion) {
        return jdbcTemplate.query(SELECT + "WHERE rcept_no = ? AND prompt_version = ?", this::map, rceptNo,
                promptVersion).stream().findFirst();
    }

    /** 결과와 호출 기록을 저장하고 id를 돌려준다. 같은 보고서·프롬프트 버전이 이미 있으면 UNIQUE 위반 */
    public long save(OutlookRecord row, List<LlmCallRow> calls) {
        String items = jsonMapper.writeValueAsString(row.items());
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO company_outlook (rcept_no, "
                    + "prompt_version, status, items, review_reason, blocked_rules, model, generated_at, "
                    + "trace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setString(1, row.rceptNo());
            ps.setString(2, row.promptVersion());
            ps.setString(3, row.status().name());
            ps.setString(4, items);
            ps.setString(5, limit(row.reviewReason(), 500));
            ps.setString(6, row.blockedRules().isEmpty() ? null : limit(String.join(",", row.blockedRules()), 200));
            ps.setString(7, limit(row.model(), 100));
            ps.setTimestamp(8, timestamp(row.generatedAt()));
            ps.setString(9, limit(row.traceId(), 64));
            ps.setTimestamp(10, timestamp(row.createdAt()));
            return ps;
        }, keys);
        long id = Objects.requireNonNull(keys.getKey(), "company_outlook id").longValue();

        List<Object[]> callRows = new ArrayList<>();
        for (LlmCallRow call : calls) {
            callRows.add(new Object[] {id, limit(call.task(), 30), limit(call.provider(), 30),
                    limit(call.model(), 100), limit(call.promptVersion(), 30), timestamp(call.calledAt()),
                    limit(call.traceId(), 64), call.inputTokens(), call.outputTokens(), call.latencyMs(),
                    call.attempt(), limit(call.outcome(), 20), limit(call.error(), 500)});
        }
        if (!callRows.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO llm_call (company_outlook_id, task, provider, model, "
                    + "prompt_version, called_at, trace_id, input_tokens, output_tokens, latency_ms, attempt, outcome, "
                    + "error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", callRows);
        }
        return id;
    }

    private OutlookRecord map(ResultSet rs, int rowNum) throws SQLException {
        String blocked = rs.getString("blocked_rules");
        return new OutlookRecord(rs.getLong("id"), rs.getString("rcept_no"), rs.getString("prompt_version"),
                OutlookStatus.valueOf(rs.getString("status")),
                List.of(jsonMapper.readValue(rs.getString("items"), OutlookItem[].class)),
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
