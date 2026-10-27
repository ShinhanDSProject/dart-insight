package com.dartinsight.relateddisclosure.repository;

import com.dartinsight.relateddisclosure.domain.DisclosureDetailType;
import com.dartinsight.relateddisclosure.domain.DisclosureTiming;
import com.dartinsight.relateddisclosure.domain.MatchLevel;
import com.dartinsight.relateddisclosure.domain.RelatedLink;
import com.dartinsight.relateddisclosure.domain.RelatedRun;
import com.dartinsight.relateddisclosure.domain.WindowDisclosure;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * 관련 수시공시 계산 결과(related_disclosure_run·related_disclosure, ADR-0030). 분석 하나에 연결이 수천 건이 될 수 있어
 * JDBC 일괄 저장을 쓴다(ADR-0011). 트랜잭션은 부르는 Service가 묶는다.
 */
@Repository
@RequiredArgsConstructor
public class RelatedDisclosureStore {

    private static final int BATCH = 500;

    private final JdbcTemplate jdbcTemplate;

    public Optional<RelatedRun> findRun(long analysisId, String ruleVersion) {
        return jdbcTemplate.query("SELECT id, analysis_id, rule_version, window_fetch_id, period_end, link_count,"
                + " trace_id, computed_at FROM related_disclosure_run WHERE analysis_id = ? AND rule_version = ?",
                (rs, rowNum) -> new RelatedRun(
                        rs.getLong("id"),
                        rs.getLong("analysis_id"),
                        rs.getString("rule_version"),
                        rs.getLong("window_fetch_id"),
                        rs.getDate("period_end").toLocalDate(),
                        rs.getInt("link_count"),
                        rs.getString("trace_id"),
                        rs.getTimestamp("computed_at").toLocalDateTime()),
                analysisId, ruleVersion).stream().findFirst();
    }

    /** 계산 기록의 연결. 변경 순서, 같은 변경 안에서는 접수일·접수번호 순서 */
    public List<RelatedLink> findLinks(long runId) {
        return jdbcTemplate.query("SELECT r.change_no, r.latest_rcept_no, r.timing, r.match_rule, r.match_level,"
                + " r.matched_fields, i.id AS item_id, i.rcept_no, i.detail_type, i.report_name, i.filer_name,"
                + " i.rcept_dt, i.remark FROM related_disclosure r JOIN disclosure_window_item i ON i.id = r.item_id"
                + " WHERE r.run_id = ? ORDER BY r.change_no, i.rcept_dt, i.rcept_no",
                (rs, rowNum) -> new RelatedLink(
                        rs.getInt("change_no"),
                        new WindowDisclosure(
                                rs.getLong("item_id"),
                                rs.getString("rcept_no"),
                                DisclosureDetailType.valueOf(rs.getString("detail_type")),
                                rs.getString("report_name"),
                                rs.getString("filer_name"),
                                rs.getDate("rcept_dt").toLocalDate(),
                                rs.getString("remark")),
                        rs.getString("latest_rcept_no"),
                        DisclosureTiming.valueOf(rs.getString("timing")),
                        rs.getString("match_rule"),
                        MatchLevel.valueOf(rs.getString("match_level")),
                        rs.getString("matched_fields")),
                runId);
    }

    /**
     * 계산 기록과 연결을 넣고 기록의 id를 돌려준다. 한 트랜잭션 안에서 불러야 한다. 연결의 공시는 저장된 것(id 있음)이어야
     * 한다. 같은 분석·규칙 버전이 이미 있으면 UNIQUE에 걸려 DataIntegrityViolationException이 난다.
     */
    public long insert(RelatedRun run, List<RelatedLink> links) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO related_disclosure_run"
                    + " (analysis_id, rule_version, window_fetch_id, period_end, link_count, trace_id, computed_at)"
                    + " VALUES (?, ?, ?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setLong(1, run.analysisId());
            ps.setString(2, run.ruleVersion());
            ps.setLong(3, run.windowFetchId());
            ps.setDate(4, Date.valueOf(run.periodEnd()));
            ps.setInt(5, run.linkCount());
            ps.setString(6, run.traceId());
            ps.setTimestamp(7, Timestamp.valueOf(run.computedAt()));
            return ps;
        }, keyHolder);
        long runId = Objects.requireNonNull(keyHolder.getKey(), "related_disclosure_run id").longValue();
        jdbcTemplate.batchUpdate("INSERT INTO related_disclosure (run_id, change_no, item_id, latest_rcept_no, timing,"
                + " match_rule, match_level, matched_fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", links, BATCH,
                (ps, link) -> {
                    ps.setLong(1, runId);
                    ps.setInt(2, link.changeNo());
                    ps.setLong(3, Objects.requireNonNull(link.disclosure().id(), "disclosure_window_item id"));
                    ps.setString(4, link.latestRceptNo());
                    ps.setString(5, link.timing().name());
                    ps.setString(6, link.matchRule());
                    ps.setString(7, link.matchLevel().name());
                    ps.setString(8, link.matchedFields());
                });
        return runId;
    }
}
