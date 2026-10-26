package com.dartinsight.question.repository;

import com.dartinsight.question.domain.CompanyQuestionRecord;
import com.dartinsight.question.domain.QuestionStatus;
import com.dartinsight.summary.domain.LlmCallRow;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * 기업 질문·답(company_question)과 그 LLM 호출 기록(llm_call, task answer, company_question_id) 저장(ADR-0029).
 * 한 트랜잭션에서 부른다.
 */
@Repository
@RequiredArgsConstructor
public class CompanyQuestionStore {

    private static final String SELECT = "SELECT id, rcept_no, question, status, answer, evidence_ids, "
            + "review_reason, blocked_rules, model, prompt_version, generated_at, trace_id, created_at "
            + "FROM company_question ";

    private final JdbcTemplate jdbcTemplate;

    /** 질문과 호출 기록을 저장하고 id를 돌려준다 */
    public long save(CompanyQuestionRecord row, List<LlmCallRow> calls) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO company_question (rcept_no, question, "
                    + "status, answer, evidence_ids, review_reason, blocked_rules, model, prompt_version, "
                    + "generated_at, trace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    new String[] {"id"});
            ps.setString(1, row.rceptNo());
            ps.setString(2, limit(row.question(), 400));
            ps.setString(3, row.status().name());
            ps.setString(4, limit(row.answer(), 1000));
            ps.setString(5, joined(row.evidenceIds(), 2000));
            ps.setString(6, limit(row.reviewReason(), 500));
            ps.setString(7, joined(row.blockedRules(), 200));
            ps.setString(8, limit(row.model(), 100));
            ps.setString(9, limit(row.promptVersion(), 30));
            ps.setTimestamp(10, timestamp(row.generatedAt()));
            ps.setString(11, limit(row.traceId(), 64));
            ps.setTimestamp(12, timestamp(row.createdAt()));
            return ps;
        }, keys);
        long id = Objects.requireNonNull(keys.getKey(), "company_question id").longValue();

        List<Object[]> callRows = new ArrayList<>();
        for (LlmCallRow call : calls) {
            callRows.add(new Object[] {id, limit(call.task(), 30), limit(call.provider(), 30),
                    limit(call.model(), 100), limit(call.promptVersion(), 30), timestamp(call.calledAt()),
                    limit(call.traceId(), 64), call.inputTokens(), call.outputTokens(), call.latencyMs(),
                    call.attempt(), limit(call.outcome(), 20), limit(call.error(), 500)});
        }
        if (!callRows.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO llm_call (company_question_id, task, provider, model, "
                    + "prompt_version, called_at, trace_id, input_tokens, output_tokens, latency_ms, attempt, outcome, "
                    + "error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", callRows);
        }
        return id;
    }

    /** 이 보고서에 한 질문, 최신 순으로 limit개 */
    public List<CompanyQuestionRecord> latest(String rceptNo, int limit) {
        return jdbcTemplate.query(SELECT + "WHERE rcept_no = ? ORDER BY created_at DESC, id DESC LIMIT ?",
                CompanyQuestionStore::map, rceptNo, limit);
    }

    /** created_at이 [from, to)인 질문의 상태별 수(AI 사용 현황). 없는 상태는 0 */
    public Map<QuestionStatus, Long> countByStatus(LocalDateTime from, LocalDateTime to) {
        Map<QuestionStatus, Long> byStatus = new EnumMap<>(QuestionStatus.class);
        for (QuestionStatus status : QuestionStatus.values()) {
            byStatus.put(status, 0L);
        }
        jdbcTemplate.query("SELECT status, COUNT(*) AS n FROM company_question "
                + "WHERE created_at >= ? AND created_at < ? GROUP BY status",
                (RowCallbackHandler) rs -> byStatus.merge(QuestionStatus.valueOf(rs.getString("status")),
                        rs.getLong("n"), Long::sum), timestamp(from), timestamp(to));
        return byStatus;
    }

    private static CompanyQuestionRecord map(ResultSet rs, int rowNum) throws SQLException {
        return new CompanyQuestionRecord(rs.getLong("id"), rs.getString("rcept_no"), rs.getString("question"),
                QuestionStatus.valueOf(rs.getString("status")), rs.getString("answer"),
                split(rs.getString("evidence_ids")), rs.getString("review_reason"),
                split(rs.getString("blocked_rules")), rs.getString("model"), rs.getString("prompt_version"),
                time(rs.getTimestamp("generated_at")), rs.getString("trace_id"),
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
