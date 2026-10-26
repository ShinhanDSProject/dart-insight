package com.dartinsight.financial.repository;

import com.dartinsight.financial.domain.FetchStatus;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.domain.KeyAccount;
import com.dartinsight.financial.domain.KeyAccountFetch;
import com.dartinsight.financial.domain.KeyAccountRow;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 보고서별 주요계정(report_key_account_fetch, report_key_account) 저장(TX-2). 저장은 한 트랜잭션에서 부른다.
 */
@Repository
@RequiredArgsConstructor
public class KeyAccountStore {

    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;

    /** 받아 둔 기록(접수번호 → 기록). 받지 않은 접수번호는 결과에 없다. */
    public Map<String, KeyAccountFetch> fetches(Collection<String> rceptNos) {
        if (rceptNos.isEmpty()) {
            return Map.of();
        }
        return namedJdbcTemplate.query("SELECT rcept_no, status, source_rcept_no, fetched_at "
                        + "FROM report_key_account_fetch WHERE rcept_no IN (:rceptNos)",
                new MapSqlParameterSource("rceptNos", rceptNos), KeyAccountStore::mapFetch).stream()
                .collect(Collectors.toMap(KeyAccountFetch::rceptNo, Function.identity()));
    }

    /** 보고서들의 한 기준(연결·별도) 계정 값 */
    public List<KeyAccountRow> rows(Collection<String> rceptNos, FsDiv fsDiv) {
        if (rceptNos.isEmpty()) {
            return List.of();
        }
        return namedJdbcTemplate.query("SELECT rcept_no, fs_div, account_key, sj_div, account_name, ord, amount, "
                        + "cumulative_amount, currency FROM report_key_account "
                        + "WHERE rcept_no IN (:rceptNos) AND fs_div = :fsDiv",
                new MapSqlParameterSource("rceptNos", rceptNos).addValue("fsDiv", fsDiv.name()),
                KeyAccountStore::mapRow);
    }

    /** 받은 기록과 계정 값을 넣는다. 같은 접수번호를 이미 넣었으면 DuplicateKeyException */
    public void save(KeyAccountFetch fetch, List<KeyAccountRow> rows) {
        jdbcTemplate.update("INSERT INTO report_key_account_fetch (rcept_no, status, source_rcept_no, fetched_at) "
                + "VALUES (?, ?, ?, ?)", fetch.rceptNo(), fetch.status().name(), fetch.sourceRceptNo(),
                Timestamp.valueOf(fetch.fetchedAt()));
        if (rows.isEmpty()) {
            return;
        }
        Timestamp fetchedAt = Timestamp.valueOf(fetch.fetchedAt());
        jdbcTemplate.batchUpdate("INSERT INTO report_key_account (rcept_no, fs_div, account_key, sj_div, "
                + "account_name, ord, amount, cumulative_amount, currency, fetched_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows, rows.size(), (ps, row) -> {
                    ps.setString(1, row.rceptNo());
                    ps.setString(2, row.fsDiv().name());
                    ps.setString(3, row.account().name());
                    ps.setString(4, row.sjDiv());
                    ps.setString(5, limit(row.accountName(), 200));
                    ps.setObject(6, row.ord(), Types.INTEGER);
                    ps.setObject(7, row.amount(), Types.BIGINT);
                    ps.setObject(8, row.cumulativeAmount(), Types.BIGINT);
                    ps.setString(9, limit(row.currency(), 10));
                    ps.setTimestamp(10, fetchedAt);
                });
    }

    private static KeyAccountFetch mapFetch(ResultSet rs, int rowNum) throws SQLException {
        Timestamp fetchedAt = rs.getTimestamp("fetched_at");
        return new KeyAccountFetch(rs.getString("rcept_no"), FetchStatus.valueOf(rs.getString("status")),
                rs.getString("source_rcept_no"), fetchedAt == null ? null : fetchedAt.toLocalDateTime());
    }

    private static KeyAccountRow mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new KeyAccountRow(rs.getString("rcept_no"), FsDiv.valueOf(rs.getString("fs_div")),
                KeyAccount.valueOf(rs.getString("account_key")), rs.getString("sj_div"), rs.getString("account_name"),
                nullableInt(rs, "ord"), nullableLong(rs, "amount"), nullableLong(rs, "cumulative_amount"),
                rs.getString("currency"));
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static Integer nullableInt(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    private static String limit(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
