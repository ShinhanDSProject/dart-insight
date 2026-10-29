package com.dartinsight.analysis.repository;

import com.dartinsight.analysis.domain.RiskSections;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextSectionCount;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 문장·표 변경 저장(text_change). 분석 하나에 수천 건이 될 수 있어 JDBC 일괄 저장을 쓴다.
 * change_no는 문서 순서(현재 보고서 기준)다.
 */
@Repository
@RequiredArgsConstructor
public class TextChangeStore {

    private static final int BATCH = 500;
    private static final String COLUMNS = "id, change_no, change_type, block_type, numbers_only, section_status, "
            + "section_title, section_path, previous_section_path, previous_rcept_no, previous_section_no, "
            + "previous_block_no, previous_text, "
            + "current_rcept_no, current_section_no, current_block_no, current_text, similarity, review_reason, "
            + "priority, priority_score, priority_reasons, priority_version";
    /** 우선순위 순: 점수가 높은 것부터, 순위를 매기지 않은 것(판단 유보)은 뒤에 문서 순서로 */
    private static final String BY_PRIORITY = "CASE WHEN priority_score IS NULL THEN 1 ELSE 0 END, "
            + "priority_score DESC, change_no";
    /** 섹션 경로의 첫 제목(최상위 섹션). 구분 글이 없으면 경로 전체 */
    private static final String TOP_SECTION = "CASE WHEN LOCATE(' > ', section_path) > 0 "
            + "THEN SUBSTRING(section_path, 1, LOCATE(' > ', section_path) - 1) ELSE section_path END";

    private final JdbcTemplate jdbcTemplate;

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
                    limit(row.previousSectionPath(), 1000),
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
                + "section_status, section_title, section_path, previous_section_path, previous_rcept_no, "
                + "previous_section_no, previous_block_no, previous_text, current_rcept_no, current_section_no, "
                + "current_block_no, current_text, similarity, review_reason, priority, priority_score, "
                + "priority_reasons, priority_version) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        for (int from = 0; from < values.size(); from += BATCH) {
            jdbcTemplate.batchUpdate(sql, values.subList(from, Math.min(values.size(), from + BATCH)));
        }
    }

    /** 유형별 건수. 키는 change_type, 없는 유형은 0. filter의 type은 보지 않는다 */
    public Map<String, Integer> counts(long analysisId, TextChangeFilter filter) {
        return countByType(analysisId, filter.withoutType());
    }

    /** 위험 관련 목차의 유형별 건수(3.9). 키는 change_type, 없는 유형은 0. filter의 type·risk는 보지 않는다 */
    public Map<String, Integer> riskCounts(long analysisId, TextChangeFilter filter) {
        return countByType(analysisId, filter.riskOnly());
    }

    private Map<String, Integer> countByType(long analysisId, TextChangeFilter filter) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String type : TextChangeRow.TYPES) {
            counts.put(type, 0);
        }
        Condition condition = Condition.of(filter);
        List<Object> args = new ArrayList<>();
        args.add(analysisId);
        args.addAll(condition.args());
        jdbcTemplate.query("SELECT change_type, COUNT(*) AS n FROM text_change WHERE analysis_id = ?"
                + condition.andSql() + " GROUP BY change_type", rs -> {
                    counts.put(rs.getString("change_type"), rs.getInt("n"));
                }, args.toArray());
        return counts;
    }

    /**
     * 변경이 있는 최상위 섹션 전부(문서 순서: 섹션의 첫 change_no 순)와 filter에 맞는 건수(0일 수 있음).
     * filter의 section은 보지 않는다.
     */
    public List<TextSectionCount> sections(long analysisId, TextChangeFilter filter) {
        Condition condition = Condition.of(filter.withoutSection());
        String hit = condition.sql().isEmpty() ? "1" : "CASE WHEN " + condition.sql() + " THEN 1 ELSE 0 END";
        List<Object> args = new ArrayList<>(condition.args());
        args.add(analysisId);
        return jdbcTemplate.query("SELECT top_section, SUM(hit) AS n, MIN(change_no) AS first_no FROM ("
                + "SELECT " + TOP_SECTION + " AS top_section, change_no, " + hit + " AS hit "
                + "FROM text_change WHERE analysis_id = ?) t GROUP BY top_section ORDER BY first_no",
                (rs, i) -> new TextSectionCount(rs.getString("top_section"), rs.getInt("n")), args.toArray());
    }

    /**
     * filter에 모두 맞는 변경 한 쪽.
     *
     * @param byPriority true면 우선순위 순({@link #BY_PRIORITY}), false면 문서 순서
     */
    public List<TextChange> page(long analysisId, TextChangeFilter filter, boolean byPriority, long offset,
            int limit) {
        Condition condition = Condition.of(filter);
        List<Object> args = new ArrayList<>();
        args.add(analysisId);
        args.addAll(condition.args());
        args.add(limit);
        args.add(offset);
        return jdbcTemplate.query("SELECT " + COLUMNS + " FROM text_change WHERE analysis_id = ?"
                + condition.andSql() + " ORDER BY " + (byPriority ? BY_PRIORITY : "change_no")
                + " LIMIT ? OFFSET ?", TextChangeStore::map, args.toArray());
    }

    /** 분석의 변경 전부(문서 순서). 관련 수시공시(3.6)가 분석 전체를 한 번에 계산할 때 쓴다 */
    public List<TextChange> all(long analysisId) {
        return jdbcTemplate.query("SELECT " + COLUMNS + " FROM text_change WHERE analysis_id = ? ORDER BY change_no",
                TextChangeStore::map, analysisId);
    }

    /** 변경이 있는 섹션 경로 전부(겹치지 않음, 문서 순서: 경로의 첫 change_no 순) */
    public List<String> sectionPaths(long analysisId) {
        return jdbcTemplate.query("SELECT section_path, MIN(change_no) AS first_no FROM text_change "
                + "WHERE analysis_id = ? AND section_path IS NOT NULL GROUP BY section_path ORDER BY first_no",
                (rs, i) -> rs.getString("section_path"), analysisId);
    }

    /** filter를 WHERE 조건으로. LIKE의 %·_는 글자 그대로 찾도록 '!'로 막는다 */
    private record Condition(String sql, List<Object> args) {

        static Condition of(TextChangeFilter filter) {
            List<String> parts = new ArrayList<>();
            List<Object> args = new ArrayList<>();
            if (!filter.types().isEmpty()) {
                parts.add("change_type IN (" + String.join(", ", Collections.nCopies(filter.types().size(), "?"))
                        + ")");
                args.addAll(filter.types());
            }
            if (filter.section() != null) {
                parts.add("(section_path = ? OR section_path LIKE ? ESCAPE '!')");
                args.add(filter.section());
                args.add(escapeLike(filter.section()) + TextChangeFilter.PATH_SEPARATOR + "%");
            }
            if (filter.q() != null) {
                parts.add("(LOWER(previous_text) LIKE ? ESCAPE '!' OR LOWER(current_text) LIKE ? ESCAPE '!' "
                        + "OR LOWER(section_path) LIKE ? ESCAPE '!')");
                String pattern = "%" + escapeLike(filter.q().toLowerCase(Locale.ROOT)) + "%";
                args.add(pattern);
                args.add(pattern);
                args.add(pattern);
            }
            if (filter.risk()) {
                parts.add(riskSql(args));
            }
            return new Condition(String.join(" AND ", parts), args);
        }

        /** 이전·현재 섹션 경로 중 하나라도 위험 관련 낱말이 든 것({@link RiskSections}와 같은 규칙: 공백을 빼고 비교) */
        private static String riskSql(List<Object> args) {
            List<String> likes = new ArrayList<>();
            for (String column : List.of("section_path", "previous_section_path")) {
                for (String keyword : RiskSections.KEYWORDS) {
                    likes.add("REPLACE(" + column + ", ?, '') LIKE ? ESCAPE '!'");
                    args.add(RiskSections.SPACE);
                    args.add("%" + escapeLike(keyword) + "%");
                }
            }
            return "(" + String.join(" OR ", likes) + ")";
        }

        String andSql() {
            return sql.isEmpty() ? "" : " AND " + sql;
        }

        private static String escapeLike(String value) {
            return value.replace("!", "!!").replace("%", "!%").replace("_", "!_");
        }
    }

    /** 변경 번호(change_no)로 찾은 변경 */
    public Optional<TextChange> findByChangeNo(long analysisId, int changeNo) {
        return jdbcTemplate.query("SELECT " + COLUMNS + " FROM text_change WHERE analysis_id = ? AND change_no = ?",
                TextChangeStore::map, analysisId, changeNo).stream().findFirst();
    }

    /**
     * 저장된 글이 text와 똑같은 첫 변경(문서 순서). currentSide면 현재 보고서 쪽 글, 아니면 이전 쪽 글을 본다(3.8 이력).
     */
    public Optional<TextChange> findByText(long analysisId, boolean currentSide, String text) {
        String column = currentSide ? "current_text" : "previous_text";
        // 정렬 규칙(대소문자 무시)에 맞는 후보를 LIKE로 좁힌 뒤, 글자까지 똑같은 것만 고른다
        return jdbcTemplate.query("SELECT " + COLUMNS + " FROM text_change WHERE analysis_id = ? AND " + column
                + " LIKE ? ESCAPE '!' ORDER BY change_no", TextChangeStore::map, analysisId,
                Condition.escapeLike(text)).stream()
                .filter(change -> {
                    Side side = currentSide ? change.row().current() : change.row().previous();
                    return side != null && text.equals(side.text());
                })
                .findFirst();
    }

    /** 이 섹션에 짝을 정하지 못한 항목(REVIEW_NEEDED)이 있는지 */
    public boolean hasReviewNeeded(long analysisId, String sectionPath) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM text_change WHERE analysis_id = ? "
                + "AND change_type = 'REVIEW_NEEDED' AND section_path = ?", Integer.class, analysisId, sectionPath);
        return count != null && count > 0;
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
                previous, current, rs.getBigDecimal("similarity"), rs.getString("review_reason"), priority(rs),
                rs.getString("previous_section_path")));
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

    public static BigDecimal similarity(Double value) {
        return value == null ? null : BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP);
    }
}
