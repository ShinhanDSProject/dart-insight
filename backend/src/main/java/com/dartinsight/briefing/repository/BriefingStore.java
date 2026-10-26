package com.dartinsight.briefing.repository;

import com.dartinsight.briefing.domain.BriefingRecord;
import com.dartinsight.briefing.domain.BriefingSentence;
import com.dartinsight.briefing.domain.BriefingStatus;
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
 * AI 기업 브리핑(company_briefing)과 그 LLM 호출 기록(llm_call, task briefing) 저장. 한 트랜잭션에서 부른다.
 * 문장과 근거는 JSON 배열 하나로 저장한다(docs/erd.md).
 */
@Repository
@RequiredArgsConstructor
public class BriefingStore {

    private static final String SELECT = "SELECT id, rcept_no, prompt_version, status, sentences, review_reason, "
            + "blocked_rules, model, generated_at, trace_id, created_at FROM company_briefing ";

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public Optional<BriefingRecord> find(String rceptNo, String promptVersion) {
        return jdbcTemplate.query(SELECT + "WHERE rcept_no = ? AND prompt_version = ?", this::map, rceptNo,
                promptVersion).stream().findFirst();
    }

    /** 브리핑과 호출 기록을 저장하고 id를 돌려준다. 같은 보고서·프롬프트 버전이 이미 있으면 UNIQUE 위반 */
    public long save(BriefingRecord row, List<LlmCallRow> calls) {
        String sentences = jsonMapper.writeValueAsString(row.sentences());
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO company_briefing (rcept_no, "
                    + "prompt_version, status, sentences, review_reason, blocked_rules, model, generated_at, "
                    + "trace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setString(1, row.rceptNo());
            ps.setString(2, row.promptVersion());
            ps.setString(3, row.status().name());
            ps.setString(4, sentences);
            ps.setString(5, limit(row.reviewReason(), 500));
            ps.setString(6, row.blockedRules().isEmpty() ? null : limit(String.join(",", row.blockedRules()), 200));
            ps.setString(7, limit(row.model(), 100));
            ps.setTimestamp(8, timestamp(row.generatedAt()));
            ps.setString(9, limit(row.traceId(), 64));
            ps.setTimestamp(10, timestamp(row.createdAt()));
            return ps;
        }, keys);
        long id = Objects.requireNonNull(keys.getKey(), "company_briefing id").longValue();

        List<Object[]> callRows = new ArrayList<>();
        for (LlmCallRow call : calls) {
            callRows.add(new Object[] {id, limit(call.task(), 30), limit(call.provider(), 30),
                    limit(call.model(), 100), limit(call.promptVersion(), 30), timestamp(call.calledAt()),
                    limit(call.traceId(), 64), call.inputTokens(), call.outputTokens(), call.latencyMs(),
                    call.attempt(), limit(call.outcome(), 20), limit(call.error(), 500)});
        }
        if (!callRows.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO llm_call (company_briefing_id, task, provider, model, "
                    + "prompt_version, called_at, trace_id, input_tokens, output_tokens, latency_ms, attempt, outcome, "
                    + "error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", callRows);
        }
        return id;
    }

    private BriefingRecord map(ResultSet rs, int rowNum) throws SQLException {
        String blocked = rs.getString("blocked_rules");
        return new BriefingRecord(rs.getLong("id"), rs.getString("rcept_no"), rs.getString("prompt_version"),
                BriefingStatus.valueOf(rs.getString("status")),
                List.of(jsonMapper.readValue(rs.getString("sentences"), BriefingSentence[].class)),
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
