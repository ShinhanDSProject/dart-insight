package com.dartinsight.keyfact.repository;

import com.dartinsight.keyfact.domain.KeyFactKind;
import com.dartinsight.keyfact.domain.KeyFactSection;
import com.dartinsight.keyfact.domain.KeyFactStatus;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

/**
 * 정기보고서 주요정보 저장(report_key_fact, docs/erd.md). 보고서·종류마다 한 행이고, 행 목록은 JSON 배열 한 칸에 둔다.
 * 저장하는 상태는 OK(자료 있음)와 NO_DATA뿐이다. 호출 실패(UNAVAILABLE)는 저장하지 않는다.
 */
@Repository
@RequiredArgsConstructor
public class ReportKeyFactStore {

    private static final String OK = "OK";

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public <T> Optional<Stored<T>> find(String rceptNo, KeyFactKind kind, Class<T> rowType) {
        JavaType listType = jsonMapper.getTypeFactory().constructCollectionType(List.class, rowType);
        List<Stored<T>> found = jdbcTemplate.query(
                "SELECT status, settlement_date, rows_json, fetched_at FROM report_key_fact "
                        + "WHERE rcept_no = ? AND kind = ?",
                (rs, i) -> {
                    KeyFactStatus status = OK.equals(rs.getString("status"))
                            ? KeyFactStatus.AVAILABLE : KeyFactStatus.NO_DATA;
                    Date date = rs.getDate("settlement_date");
                    List<T> rows = jsonMapper.readValue(rs.getString("rows_json"), listType);
                    return new Stored<>(new KeyFactSection<>(rceptNo, status,
                            date == null ? null : date.toLocalDate(), rows),
                            rs.getTimestamp("fetched_at").toLocalDateTime());
                },
                rceptNo, kind.name());
        return found.stream().findFirst();
    }

    /**
     * 저장된 행이 있으면 바꾸고, 없으면 넣는다. 같은 보고서·종류를 동시에 넣었으면 먼저 넣은 결과를 둔다.
     *
     * @param section AVAILABLE 또는 NO_DATA
     */
    public void save(KeyFactKind kind, KeyFactSection<?> section, LocalDateTime fetchedAt) {
        if (section.status() == KeyFactStatus.UNAVAILABLE) {
            throw new IllegalStateException("받지 못한 결과는 저장하지 않습니다.");
        }
        String status = section.available() ? OK : KeyFactStatus.NO_DATA.name();
        String rowsJson = jsonMapper.writeValueAsString(section.rows());
        LocalDate date = section.settlementDate();
        Date settlementDate = date == null ? null : Date.valueOf(date);
        Timestamp fetched = Timestamp.valueOf(fetchedAt);
        int updated = jdbcTemplate.update("UPDATE report_key_fact SET status = ?, settlement_date = ?, rows_json = ?, "
                + "fetched_at = ? WHERE rcept_no = ? AND kind = ?",
                status, settlementDate, rowsJson, fetched, section.rceptNo(), kind.name());
        if (updated > 0) {
            return;
        }
        try {
            jdbcTemplate.update("INSERT INTO report_key_fact (rcept_no, kind, status, settlement_date, rows_json, "
                    + "fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
                    section.rceptNo(), kind.name(), status, settlementDate, rowsJson, fetched);
        } catch (DuplicateKeyException e) {
            // 같은 요청이 동시에 넣었다. 그 결과를 둔다
        }
    }

    /** @param fetchedAt 받은 시각. 자료 없음(NO_DATA)을 다시 받을지 정할 때 쓴다 */
    public record Stored<T>(KeyFactSection<T> section, LocalDateTime fetchedAt) {
    }
}
