package com.dartinsight.company.repository;

import com.dartinsight.company.domain.CompanyNameKey;
import com.dartinsight.dart.domain.CorpCodeEntry;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 기업 목록 새로 넣기. 처음 받을 때 10만 건이 넘는데, 자동 증가 키(IDENTITY)는 JPA 일괄 INSERT가 되지 않아
 * JDBC 일괄 저장을 쓴다(ADR-0011, ADR-0017). 이미 있는 기업을 고치는 것은 JPA 엔티티로 한다.
 * 검색용 이름(corp_name_key·corp_name_chosung)은 CompanyNameKey로 계산해 함께 넣는다.
 */
@Repository
@RequiredArgsConstructor
public class CompanyStore {

    private static final int BATCH = 500;

    private final JdbcTemplate jdbcTemplate;

    public void insertAll(List<CorpCodeEntry> entries, LocalDateTime now) {
        Timestamp at = Timestamp.valueOf(now);
        jdbcTemplate.batchUpdate("INSERT INTO company (corp_code, corp_name, corp_name_key, corp_name_chosung,"
                + " corp_eng_name, stock_code, modify_date, created_at, updated_at)"
                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", entries, BATCH, (ps, entry) -> {
                    ps.setString(1, entry.corpCode());
                    ps.setString(2, entry.corpName());
                    ps.setString(3, CompanyNameKey.key(entry.corpName()));
                    ps.setString(4, CompanyNameKey.chosung(entry.corpName()));
                    ps.setString(5, entry.corpEngName());
                    ps.setString(6, entry.stockCode());
                    ps.setDate(7, entry.modifyDate() == null ? null : Date.valueOf(entry.modifyDate()));
                    ps.setTimestamp(8, at);
                    ps.setTimestamp(9, at);
                });
    }

    /**
     * 검색용 이름이 비어 있는 행을 id 순서로 최대 limit건 채우고, 채운 건수를 돌려준다.
     * 이미 채운 행은 건드리지 않으므로 여러 번 불러도 같다. updated_at은 바꾸지 않는다(OpenDART 값이 바뀐 것이 아님).
     */
    public int fillMissingNameKeys(int limit) {
        List<NameRow> rows = jdbcTemplate.query("SELECT id, corp_name FROM company"
                + " WHERE corp_name_key IS NULL OR corp_name_chosung IS NULL ORDER BY id LIMIT ?",
                (rs, rowNum) -> new NameRow(rs.getLong("id"), rs.getString("corp_name")), limit);
        if (rows.isEmpty()) {
            return 0;
        }
        jdbcTemplate.batchUpdate("UPDATE company SET corp_name_key = ?, corp_name_chosung = ? WHERE id = ?",
                rows, BATCH, (ps, row) -> {
                    ps.setString(1, CompanyNameKey.key(row.corpName()));
                    ps.setString(2, CompanyNameKey.chosung(row.corpName()));
                    ps.setLong(3, row.id());
                });
        return rows.size();
    }

    private record NameRow(long id, String corpName) {
    }
}
