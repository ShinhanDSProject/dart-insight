package com.dartinsight.summary.repository;

import com.dartinsight.summary.domain.LlmCallRow;
import com.dartinsight.summary.domain.LlmCallUsage;
import com.dartinsight.summary.domain.LlmCallUsage.ModelTokens;
import com.dartinsight.summary.domain.LlmCallUsage.ModelUsage;
import com.dartinsight.summary.domain.LlmCallUsage.TaskUsage;
import com.dartinsight.summary.domain.LlmCallUsage.UnitUsage;
import com.dartinsight.summary.domain.SummaryItemRow;
import com.dartinsight.summary.domain.SummaryResult;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;

/** 요약(summary_item)과 LLM 호출 기록(llm_call) 저장. 분석 결과와 같은 트랜잭션에서 부른다. */
@Repository
@RequiredArgsConstructor
public class SummaryStore {

    private final JdbcTemplate jdbcTemplate;

    /**
     * @param financialIds 재무 수치 결과 목록 순서 → 저장된 financial_change.id
     */
    public void save(long analysisId, SummaryResult summary, List<Long> financialIds) {
        List<Object[]> items = new ArrayList<>();
        int itemNo = 0;
        for (SummaryItemRow row : summary.items()) {
            Long financialId = row.financialIndex() == null ? null : financialIds.get(row.financialIndex());
            items.add(new Object[] {analysisId, ++itemNo, row.kind(), row.status(), limit(row.factSentence(), 500),
                    limit(row.aiText(), 1000), row.explanationStatus(),
                    limit(String.join(",", row.evidenceIds()), 2000), financialId, row.textChangeNo(),
                    limit(row.reviewReason(), 500), limit(row.model(), 100), limit(row.promptVersion(), 30),
                    timestamp(row.generatedAt()), joined(row.blockedRules(), 200), row.explanationGrade(),
                    limit(row.quote(), 1500), limit(row.quoteEvidenceId(), 40)});
        }
        if (!items.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO summary_item (analysis_id, item_no, kind, status, fact_sentence, "
                + "ai_text, explanation_status, evidence_ids, financial_change_id, text_change_no, review_reason, "
                    + "model, prompt_version, generated_at, blocked_rules, explanation_grade, quote, "
                    + "quote_evidence_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", items);
        }
        saveCalls(analysisId, summary.calls());
    }

    /** 분석의 LLM 호출 기록. 분석이 실패로 끝날 때는 요약 없이 이것만 부른다(#137, ADR-0042) */
    public void saveCalls(long analysisId, List<LlmCallRow> llmCalls) {
        List<Object[]> calls = new ArrayList<>();
        for (LlmCallRow call : llmCalls) {
            calls.add(new Object[] {analysisId, limit(call.task(), 30), limit(call.provider(), 30),
                    limit(call.model(), 100), limit(call.promptVersion(), 30), timestamp(call.calledAt()),
                    limit(call.traceId(), 64), call.inputTokens(), call.outputTokens(), call.latencyMs(),
                    call.attempt(), limit(call.outcome(), 20), limit(call.error(), 500)});
        }
        if (!calls.isEmpty()) {
            jdbcTemplate.batchUpdate("INSERT INTO llm_call (analysis_id, task, provider, model, prompt_version, "
                + "called_at, trace_id, input_tokens, output_tokens, latency_ms, attempt, outcome, error) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", calls);
        }
    }

    public List<StoredItem> items(long analysisId) {
        return jdbcTemplate.query("SELECT item_no, kind, status, fact_sentence, ai_text, explanation_status, "
                + "evidence_ids, financial_change_id, text_change_no, review_reason, model, prompt_version, "
                + "generated_at, blocked_rules, explanation_grade, quote, quote_evidence_id FROM summary_item "
                + "WHERE analysis_id = ? ORDER BY item_no", SummaryStore::map,
                analysisId);
    }

    /** LLM 호출 수와 토큰 합(비용 집계) */
    public List<LlmCallRow> calls(long analysisId) {
        return jdbcTemplate.query("SELECT task, provider, model, prompt_version, called_at, trace_id, input_tokens, "
                + "output_tokens, latency_ms, attempt, outcome, error FROM llm_call WHERE analysis_id = ? ORDER BY id",
                (rs, i) -> new LlmCallRow(rs.getString("task"), rs.getString("provider"), rs.getString("model"),
                        rs.getString("prompt_version"), time(rs.getTimestamp("called_at")), rs.getString("trace_id"),
                        rs.getObject("input_tokens", Integer.class), rs.getObject("output_tokens", Integer.class),
                        rs.getInt("latency_ms"), rs.getInt("attempt"), rs.getString("outcome"),
                        rs.getString("error")), analysisId);
    }

    /** called_at이 [from, to)인 LLM 호출의 결과별 수와 작업별 호출 수·토큰 합(AI 사용 현황). 어느 작업의 호출이든 센다 */
    public LlmCallUsage llmCallUsage(LocalDateTime from, LocalDateTime to) {
        Map<String, Long> byOutcome = new LinkedHashMap<>();
        for (String outcome : LlmCallUsage.OUTCOMES) {
            byOutcome.put(outcome, 0L);
        }
        jdbcTemplate.query("SELECT outcome, COUNT(*) AS n FROM llm_call "
                + "WHERE called_at >= ? AND called_at < ? GROUP BY outcome ORDER BY outcome",
                (RowCallbackHandler) rs -> byOutcome.merge(rs.getString("outcome"), rs.getLong("n"), Long::sum),
                timestamp(from), timestamp(to));
        List<TaskUsage> byTask = jdbcTemplate.query("SELECT task, COUNT(*) AS n, SUM(input_tokens) AS input_sum, "
                + "SUM(output_tokens) AS output_sum FROM llm_call WHERE called_at >= ? AND called_at < ? "
                + "GROUP BY task ORDER BY task",
                (rs, i) -> new TaskUsage(rs.getString("task"), rs.getLong("n"), nullableLong(rs, "input_sum"),
                        nullableLong(rs, "output_sum")), timestamp(from), timestamp(to));
        return new LlmCallUsage(byOutcome, byTask, byModel(from, to), units("analysis_id", from, to),
                units("company_briefing_id", from, to), units("company_outlook_id", from, to),
                units("plan_followup_id", from, to));
    }

    /** 제공자·모델별 호출 수·토큰 합과 그 안의 작업별 집계(제공자, 모델, 작업 이름 순서) */
    private List<ModelUsage> byModel(LocalDateTime from, LocalDateTime to) {
        Map<List<String>, List<TaskUsage>> tasks = new LinkedHashMap<>();
        jdbcTemplate.query("SELECT provider, model, task, COUNT(*) AS n, SUM(input_tokens) AS input_sum, "
                + "SUM(output_tokens) AS output_sum FROM llm_call WHERE called_at >= ? AND called_at < ? "
                + "GROUP BY provider, model, task ORDER BY provider, model, task",
                (RowCallbackHandler) rs -> tasks.computeIfAbsent(List.of(rs.getString("provider"),
                        rs.getString("model")), key -> new ArrayList<>()).add(new TaskUsage(rs.getString("task"),
                        rs.getLong("n"), nullableLong(rs, "input_sum"), nullableLong(rs, "output_sum"))),
                timestamp(from), timestamp(to));
        return jdbcTemplate.query("SELECT provider, model, COUNT(*) AS n, SUM(input_tokens) AS input_sum, "
                + "SUM(output_tokens) AS output_sum FROM llm_call WHERE called_at >= ? AND called_at < ? "
                + "GROUP BY provider, model ORDER BY provider, model",
                (rs, i) -> new ModelUsage(rs.getString("provider"), rs.getString("model"), rs.getLong("n"),
                        nullableLong(rs, "input_sum"), nullableLong(rs, "output_sum"),
                        tasks.getOrDefault(List.of(rs.getString("provider"), rs.getString("model")), List.of())),
                timestamp(from), timestamp(to));
    }

    /**
     * 기간 안에 호출이 있는 작업 단위(분석·브리핑·전망·대조)의 수와, 그 호출들의 제공자·모델별 토큰 합.
     *
     * @param unitColumn analysis_id, company_briefing_id, company_outlook_id, plan_followup_id 중 하나
     *     (이 클래스 안에서만 넘기는 고정 값)
     */
    private UnitUsage units(String unitColumn, LocalDateTime from, LocalDateTime to) {
        String window = " FROM llm_call WHERE called_at >= ? AND called_at < ? AND " + unitColumn + " IS NOT NULL";
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(DISTINCT " + unitColumn + ")" + window, Long.class,
                timestamp(from), timestamp(to));
        List<ModelTokens> byModel = jdbcTemplate.query("SELECT provider, model, SUM(input_tokens) AS input_sum, "
                + "SUM(output_tokens) AS output_sum" + window + " GROUP BY provider, model ORDER BY provider, model",
                (rs, i) -> new ModelTokens(rs.getString("provider"), rs.getString("model"),
                        nullableLong(rs, "input_sum"), nullableLong(rs, "output_sum")),
                timestamp(from), timestamp(to));
        return new UnitUsage(count == null ? 0 : count, byModel);
    }

    /** SUM 결과(MariaDB는 DECIMAL, H2는 BIGINT). 더할 값이 없으면 null */
    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static StoredItem map(ResultSet rs, int rowNum) throws SQLException {
        String evidence = rs.getString("evidence_ids");
        String blocked = rs.getString("blocked_rules");
        SummaryItemRow row = new SummaryItemRow(rs.getString("kind"), rs.getString("status"),
                rs.getString("fact_sentence"), rs.getString("ai_text"), rs.getString("explanation_status"),
                split(evidence), null,
                rs.getObject("text_change_no", Integer.class), rs.getString("review_reason"), rs.getString("model"),
                rs.getString("prompt_version"), time(rs.getTimestamp("generated_at")), split(blocked),
                rs.getString("explanation_grade"), rs.getString("quote"), rs.getString("quote_evidence_id"));
        return new StoredItem(rs.getInt("item_no"), row, rs.getObject("financial_change_id", Long.class));
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

    /** 저장된 요약 한 줄. financialChangeId는 재무 수치 근거(financial_change.id) */
    public record StoredItem(int itemNo, SummaryItemRow row, Long financialChangeId) {
    }
}
