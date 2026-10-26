package com.dartinsight.relateddisclosure.repository;

import com.dartinsight.relateddisclosure.domain.DisclosureDetailType;
import com.dartinsight.relateddisclosure.domain.WindowDisclosure;
import com.dartinsight.relateddisclosure.domain.WindowFetch;
import com.dartinsight.relateddisclosure.domain.WindowFetchStatus;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * 관련 수시공시의 기간 공시 목록(disclosure_window_fetch·disclosure_window_item, ADR-0030). 기간에 따라 수백 건이라
 * JDBC 일괄 저장을 쓴다(ADR-0011). 트랜잭션은 부르는 Service가 묶는다.
 */
@Repository
@RequiredArgsConstructor
public class DisclosureWindowStore {

    private static final int BATCH = 500;

    private final JdbcTemplate jdbcTemplate;

    public Optional<WindowFetch> findFetch(String corpCode, LocalDate beginDate, LocalDate endDate) {
        return jdbcTemplate.query("SELECT id, corp_code, begin_date, end_date, status, fetched_at"
                + " FROM disclosure_window_fetch WHERE corp_code = ? AND begin_date = ? AND end_date = ?",
                (rs, rowNum) -> new WindowFetch(
                        rs.getLong("id"),
                        rs.getString("corp_code"),
                        rs.getDate("begin_date").toLocalDate(),
                        rs.getDate("end_date").toLocalDate(),
                        WindowFetchStatus.valueOf(rs.getString("status")),
                        rs.getTimestamp("fetched_at").toLocalDateTime()),
                corpCode, Date.valueOf(beginDate), Date.valueOf(endDate)).stream().findFirst();
    }

    /** 받은 기록의 공시. 접수일이 이른 순서, 같은 날이면 접수번호 순서 */
    public List<WindowDisclosure> findItems(long fetchId) {
        return jdbcTemplate.query("SELECT id, rcept_no, detail_type, report_name, filer_name, rcept_dt, remark"
                + " FROM disclosure_window_item WHERE fetch_id = ? ORDER BY rcept_dt, rcept_no",
                (rs, rowNum) -> new WindowDisclosure(
                        rs.getLong("id"),
                        rs.getString("rcept_no"),
                        DisclosureDetailType.valueOf(rs.getString("detail_type")),
                        rs.getString("report_name"),
                        rs.getString("filer_name"),
                        rs.getDate("rcept_dt").toLocalDate(),
                        rs.getString("remark")),
                fetchId);
    }

    /**
     * 받은 기록과 공시를 넣고 받은 기록의 id를 돌려준다. 한 트랜잭션 안에서 불러야 한다. 같은 기업·기간이 이미 있으면
     * UNIQUE에 걸려 DataIntegrityViolationException이 난다.
     */
    public long insert(WindowFetch fetch, List<WindowDisclosure> items) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("INSERT INTO disclosure_window_fetch"
                    + " (corp_code, begin_date, end_date, status, fetched_at) VALUES (?, ?, ?, ?, ?)",
                    new String[] {"id"});
            ps.setString(1, fetch.corpCode());
            ps.setDate(2, Date.valueOf(fetch.beginDate()));
            ps.setDate(3, Date.valueOf(fetch.endDate()));
            ps.setString(4, fetch.status().name());
            ps.setTimestamp(5, Timestamp.valueOf(fetch.fetchedAt()));
            return ps;
        }, keyHolder);
        long fetchId = Objects.requireNonNull(keyHolder.getKey(), "disclosure_window_fetch id").longValue();
        jdbcTemplate.batchUpdate("INSERT INTO disclosure_window_item (fetch_id, rcept_no, detail_type, report_name,"
                + " filer_name, rcept_dt, remark) VALUES (?, ?, ?, ?, ?, ?, ?)", items, BATCH, (ps, d) -> {
                    ps.setLong(1, fetchId);
                    ps.setString(2, d.rceptNo());
                    ps.setString(3, d.detailType().name());
                    ps.setString(4, d.reportName());
                    ps.setString(5, d.filerName());
                    ps.setDate(6, Date.valueOf(d.rceptDt()));
                    ps.setString(7, d.remark());
                });
        return fetchId;
    }
}
