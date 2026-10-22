package com.dartinsight.analysis;

import com.dartinsight.analysis.TextChangeRow.Side;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 문장·표 변경 저장(text_change). 분석 하나에 수천 건이 될 수 있어 JDBC 일괄 저장을 쓴다.
 * change_no는 문서 순서(현재 보고서 기준)다.
 */
@Repository
public class TextChangeStore {

    private static final int BATCH = 500;
    private static final String COLUMNS = "id, change_no, change_type, block_type, numbers_only, section_status, "
            + "section_title, section_path, previous_rcept_no, previous_section_no, previous_block_no, previous_text, "
            + "current_rcept_no, current_section_no, current_block_no, current_text, similarity, review_reason, "
            + "priority, priority_score, priority_reasons, priority_version";
    /** 우선순위 순: 점수가 높은 것부터, 순위를 매기지 않은 것(판단 유보)은 뒤에 문서 순서로 */
    private static final String BY_PRIORITY = "CASE WHEN priority_score IS NULL THEN 1 ELSE 0 END, "
            + "priority_score DESC, change_no";

    private final JdbcTemplate jdbcTemplate;

    public TextChangeStore(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** 트랜잭션 안에서 부른다. */
    public void saveAll(long analysisId, List<TextChangeRow> rows) {
        List<Object[]> values = new ArrayList<>(rows.size());
        for (int i = 0; i < rows.size(); i++) {
            TextChangeRow row = rows.get(i);
            Side p = row.previous();
            Side c = row.current();
            TextChangeRow.Priority priority = row.priority();
            values.add(new Object[] {analysisId, i + 1, row.changeType(), row.blockType(), row.numbersOnly(),
                    row.sectionStatus(), limit(row.sectionTitle(), 500), limit(row.sectionPath(), 1000),
                    p == null ? null : p.rceptNo(), p == null ? null : p.sectionNo(), p == null ? null : p.blockNo(),
                    p == null ? null : p.text(),
                    c == null ? null : c.rceptNo(), c == null ? null : c.sectionNo(), c == null ? null : c.blockNo(),
                    c == null ? null : c.text(),
                    row.similarity(), limit(row.reviewReason(), 500),
                    priority == null ? null : priority.level(), priority == null ? null : priority.score(),
                    priority == null ? null : limit(String.join("\n", priority.reasons()), 1000),
                    priority == null ? null : priority.version()});
        }
        String sql = "INSERT INTO text_change (analysis_id, change_no, change_type, block_type, numbers_only, "
                + "section_status, section_title, section_path, previous_rcept_no, previous_section_no, "
                + "previous_block_no, previous_text, current_rcept_no, current_section_no, current_block_no, "
                + "current_text, similarity, review_reason, priority, priority_score, priority_reasons, "
                + "priority_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        for (int from = 0; from < values.size(); from += BATCH) {
            jdbcTemplate.batchUpdate(sql, values.subList(from, Math.min(values.size(), from + BATCH)));
        }
    }

    /** 유형별 건수. 키는 change_type, 없는 유형은 0 */
    public Map<String, Integer> counts(long analysisId) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String type : List.of(TextChangeRow.ADDED, TextChangeRow.DELETED, TextChangeRow.MODIFIED,
                TextChangeRow.REVIEW_NEEDED)) {
            counts.put(type, 0);
        }
        jdbcTemplate.query("SELECT change_type, COUNT(*) AS n FROM text_change WHERE analysis_id = ? "
                + "GROUP BY change_type", rs -> {
                    counts.put(rs.getString("change_type"), rs.getInt("n"));
                }, analysisId);
        return counts;
    }

    /**
     * 한 쪽. type이 null이면 전체.
     *
     * @param byPriority true면 우선순위 순({@link #BY_PRIORITY}), false면 문서 순서
     */
    public List<TextChange> page(long analysisId, String type, boolean byPriority, long offset, int limit) {
        String order = " ORDER BY " + (byPriority ? BY_PRIORITY : "change_no") + " LIMIT ? OFFSET ?";
        if (type == null) {
            return jdbcTemplate.query("SELECT " + COLUMNS + " FROM text_change WHERE analysis_id = ?" + order,
                    TextChangeStore::map, analysisId, limit, offset);
        }
        return jdbcTemplate.query("SELECT " + COLUMNS + " FROM text_change WHERE analysis_id = ? AND change_type = ?"
                + order, TextChangeStore::map, analysisId, type, limit, offset);
    }

    /** 변경 번호(change_no)로 찾은 변경 ID */
    public Optional<Long> idOf(long analysisId, int changeNo) {
        return jdbcTemplate.query("SELECT id FROM text_change WHERE analysis_id = ? AND change_no = ?",
                (rs, i) -> rs.getLong("id"), analysisId, changeNo).stream().findFirst();
    }

    public Optional<TextChange> find(long analysisId, long changeId) {
        return jdbcTemplate.query("SELECT " + COLUMNS + " FROM text_change WHERE analysis_id = ? AND id = ?",
                TextChangeStore::map, analysisId, changeId).stream().findFirst();
    }

    private static TextChange map(ResultSet rs, int rowNum) throws SQLException {
        Side previous = side(rs, "previous");
        Side current = side(rs, "current");
        return new TextChange(rs.getLong("id"), rs.getInt("change_no"), new TextChangeRow(
                rs.getString("change_type"), rs.getString("block_type"), rs.getBoolean("numbers_only"),
                rs.getString("section_status"), rs.getString("section_title"), rs.getString("section_path"),
                previous, current, rs.getBigDecimal("similarity"), rs.getString("review_reason"), priority(rs)));
    }

    private static TextChangeRow.Priority priority(ResultSet rs) throws SQLException {
        String level = rs.getString("priority");
        if (level == null) {
            return null;
        }
        String reasons = rs.getString("priority_reasons");
        return new TextChangeRow.Priority(level, rs.getObject("priority_score", Integer.class),
                reasons == null || reasons.isEmpty() ? List.of() : List.of(reasons.split("\n")),
                rs.getString("priority_version"));
    }

    private static Side side(ResultSet rs, String prefix) throws SQLException {
        String rceptNo = rs.getString(prefix + "_rcept_no");
        if (rceptNo == null) {
            return null;
        }
        return new Side(rceptNo, rs.getInt(prefix + "_section_no"), rs.getObject(prefix + "_block_no", Integer.class),
                rs.getString(prefix + "_text"));
    }

    private static String limit(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    /** 저장된 문장·표 변경 */
    public record TextChange(long id, int changeNo, TextChangeRow row) {
    }

    static BigDecimal similarity(Double value) {
        return value == null ? null : BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP);
    }
}
