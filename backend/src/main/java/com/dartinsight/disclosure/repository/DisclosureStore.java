package com.dartinsight.disclosure.repository;

import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureFetch;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 최근 공시 목록 캐시(company_disclosure_fetch·company_disclosure). 큰 기업은 1년에 공시가 수천 건이라
 * JDBC 일괄 저장을 쓴다(ADR-0011). 트랜잭션은 부르는 Service가 묶는다.
 */
@Repository
@RequiredArgsConstructor
public class DisclosureStore {

    private static final int BATCH = 500;

    private final JdbcTemplate jdbcTemplate;

    public Optional<DisclosureFetch> findFetch(String corpCode) {
        return jdbcTemplate.query("SELECT corp_code, covered_from, covered_to, fetched_at FROM company_disclosure_fetch"
                + " WHERE corp_code = ?", (rs, rowNum) -> new DisclosureFetch(
                        rs.getString("corp_code"),
                        rs.getDate("covered_from").toLocalDate(),
                        rs.getDate("covered_to").toLocalDate(),
                        rs.getTimestamp("fetched_at").toLocalDateTime()), corpCode)
                .stream().findFirst();
    }

    /** 접수일이 from 이후인 공시. 접수일이 최근인 순서, 같은 날이면 접수번호가 큰 순서 */
    public List<Disclosure> findSince(String corpCode, LocalDate from) {
        return jdbcTemplate.query("SELECT rcept_no, report_name, filer_name, rcept_dt, remark FROM company_disclosure"
                + " WHERE corp_code = ? AND rcept_dt >= ? ORDER BY rcept_dt DESC, rcept_no DESC",
                (rs, rowNum) -> new Disclosure(
                        rs.getString("rcept_no"),
                        rs.getString("report_name"),
                        rs.getString("filer_name"),
                        rs.getDate("rcept_dt").toLocalDate(),
                        rs.getString("remark")),
                corpCode, Date.valueOf(from));
    }

    /** 이 기업의 저장된 목록과 받은 기록을 지우고 새로 넣는다. 한 트랜잭션 안에서 불러야 한다. */
    public void replace(DisclosureFetch fetch, List<Disclosure> disclosures) {
        jdbcTemplate.update("DELETE FROM company_disclosure WHERE corp_code = ?", fetch.corpCode());
        jdbcTemplate.update("DELETE FROM company_disclosure_fetch WHERE corp_code = ?", fetch.corpCode());
        jdbcTemplate.update("INSERT INTO company_disclosure_fetch (corp_code, covered_from, covered_to, fetched_at)"
                + " VALUES (?, ?, ?, ?)", fetch.corpCode(), Date.valueOf(fetch.fromDate()),
                Date.valueOf(fetch.toDate()), Timestamp.valueOf(fetch.fetchedAt()));
        Timestamp createdAt = Timestamp.valueOf(fetch.fetchedAt());
        jdbcTemplate.batchUpdate("INSERT INTO company_disclosure (corp_code, rcept_no, report_name, filer_name,"
                + " rcept_dt, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", disclosures, BATCH, (ps, d) -> {
                    ps.setString(1, fetch.corpCode());
                    ps.setString(2, d.rceptNo());
                    ps.setString(3, d.reportName());
                    ps.setString(4, d.filerName());
                    ps.setDate(5, Date.valueOf(d.rceptDt()));
                    ps.setString(6, d.remark());
                    ps.setTimestamp(7, createdAt);
                });
    }
}
