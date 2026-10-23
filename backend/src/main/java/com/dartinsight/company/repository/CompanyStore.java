package com.dartinsight.company.repository;

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
 */
@Repository
@RequiredArgsConstructor
public class CompanyStore {

    private static final int BATCH = 500;

    private final JdbcTemplate jdbcTemplate;

    public void insertAll(List<CorpCodeEntry> entries, LocalDateTime now) {
        Timestamp at = Timestamp.valueOf(now);
        jdbcTemplate.batchUpdate("INSERT INTO company (corp_code, corp_name, corp_eng_name, stock_code, modify_date,"
                + " created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", entries, BATCH, (ps, entry) -> {
                    ps.setString(1, entry.corpCode());
                    ps.setString(2, entry.corpName());
                    ps.setString(3, entry.corpEngName());
                    ps.setString(4, entry.stockCode());
                    ps.setDate(5, entry.modifyDate() == null ? null : Date.valueOf(entry.modifyDate()));
                    ps.setTimestamp(6, at);
                    ps.setTimestamp(7, at);
                });
    }
}
