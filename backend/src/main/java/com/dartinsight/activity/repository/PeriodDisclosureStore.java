package com.dartinsight.activity.repository;

import com.dartinsight.activity.domain.PeriodDisclosure;
import com.dartinsight.activity.domain.PeriodDisclosures;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * 공시 분석 탭의 사이 기간 공시 목록(disclosure_window_fetch·disclosure_window_item의 EVENT 범위, ADR-0068).
 * 트랜잭션은 부르는 쪽이 묶는다.
 */
@Repository
@RequiredArgsConstructor
public class PeriodDisclosureStore {

    private static final String SCOPE = "EVENT";
    private static final String OK = "OK";
    private static final String NO_DATA = "NO_DATA";
    private static final int BATCH = 500;

    private final JdbcTemplate jdbcTemplate;

    /** 받은 기록과 공시. 접수일이 이른 순서, 같은 날이면 접수번호 순서 */
    public Optional<PeriodDisclosures> find(String corpCode, LocalDate from, LocalDate to) {
        return jdbcTemplate.query("SELECT id, fetched_at FROM disclosure_window_fetch"
                + " WHERE corp_code = ? AND begin_date = ? AND end_date = ? AND scope = ?",
                (rs, rowNum) -> new PeriodDisclosures(rs.getTimestamp("fetched_at").toLocalDateTime(),
                        items(rs.getLong("id"))),
                corpCode, Date.valueOf(from), Date.valueOf(to), SCOPE).stream().findFirst();
    }

    private List<PeriodDisclosure> items(long fetchId) {
        return jdbcTemplate.query("SELECT rcept_no, detail_type, report_name, filer_name, rcept_dt, remark"
                + " FROM disclosure_window_item WHERE fetch_id = ? ORDER BY rcept_dt, rcept_no",
                (rs, rowNum) -> new PeriodDisclosure(rs.getString("rcept_no"), rs.getString("detail_type"),
                        rs.getString("report_name"), rs.getString("filer_name"),
                        rs.getDate("rcept_dt").toLocalDate(), rs.getString("remark")),
                fetchId);
    }

    /** 같은 기업·기간이 이미 있으면 UNIQUE에 걸려 DataIntegrityViolationException이 난다 */
    public void insert(String corpCode, LocalDate from, LocalDate to, List<PeriodDisclosure> items,
            LocalDateTime fetchedAt) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO disclosure_window_fetch"
                    + " (corp_code, begin_date, end_date, scope, status, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
                    new String[] {"id"});
            ps.setString(1, corpCode);
            ps.setDate(2, Date.valueOf(from));
            ps.setDate(3, Date.valueOf(to));
            ps.setString(4, SCOPE);
            ps.setString(5, items.isEmpty() ? NO_DATA : OK);
            ps.setTimestamp(6, Timestamp.valueOf(fetchedAt));
            return ps;
        }, keyHolder);
        long fetchId = Objects.requireNonNull(keyHolder.getKey(), "disclosure_window_fetch id").longValue();
        jdbcTemplate.batchUpdate("INSERT INTO disclosure_window_item (fetch_id, rcept_no, detail_type, report_name,"
                + " filer_name, rcept_dt, remark) VALUES (?, ?, ?, ?, ?, ?, ?)", items, BATCH, (ps, d) -> {
                    ps.setLong(1, fetchId);
                    ps.setString(2, d.rceptNo());
                    ps.setString(3, d.type());
                    ps.setString(4, d.reportName());
                    ps.setString(5, d.filerName());
                    ps.setDate(6, Date.valueOf(d.rceptDt()));
                    ps.setString(7, d.remark());
                });
    }
}
