package com.dartinsight.disclosure.repository;

import com.dartinsight.disclosure.domain.AuditOpinionRow;
import com.dartinsight.disclosure.domain.AuditOpinions;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

/**
 * 사업보고서의 회계감사인·감사의견 저장(disclosure_audit_opinion, docs/erd.md). 사업보고서마다 한 행이고 행 목록은 JSON 배열 한
 * 칸에 둔다. 저장하는 상태는 OK(자료 있음)와 NO_DATA뿐이다. 호출 실패는 저장하지 않는다.
 */
@Repository
@RequiredArgsConstructor
public class DisclosureAuditOpinionStore {

    private static final String OK = "OK";
    private static final String NO_DATA = "NO_DATA";

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public Optional<AuditOpinions> find(String rceptNo) {
        JavaType listType = jsonMapper.getTypeFactory().constructCollectionType(List.class, AuditOpinionRow.class);
        return jdbcTemplate.query("SELECT status, source_rcept_no, rows_json, fetched_at"
                + " FROM disclosure_audit_opinion WHERE rcept_no = ?", (rs, i) -> new AuditOpinions(
                        rceptNo,
                        OK.equals(rs.getString("status")),
                        rs.getString("source_rcept_no"),
                        jsonMapper.<List<AuditOpinionRow>>readValue(rs.getString("rows_json"), listType),
                        rs.getTimestamp("fetched_at").toLocalDateTime()), rceptNo)
                .stream().findFirst();
    }

    /** 저장된 행이 있으면 바꾸고, 없으면 넣는다. 같은 보고서를 동시에 넣었으면 먼저 넣은 결과를 둔다. */
    public void save(AuditOpinions opinions) {
        String status = opinions.available() ? OK : NO_DATA;
        String rowsJson = jsonMapper.writeValueAsString(opinions.rows());
        Timestamp fetchedAt = Timestamp.valueOf(opinions.fetchedAt());
        int updated = jdbcTemplate.update("UPDATE disclosure_audit_opinion SET status = ?, source_rcept_no = ?,"
                + " rows_json = ?, fetched_at = ? WHERE rcept_no = ?", status, opinions.sourceRceptNo(), rowsJson,
                fetchedAt, opinions.rceptNo());
        if (updated > 0) {
            return;
        }
        try {
            jdbcTemplate.update("INSERT INTO disclosure_audit_opinion (rcept_no, status, source_rcept_no, rows_json,"
                    + " fetched_at) VALUES (?, ?, ?, ?, ?)", opinions.rceptNo(), status, opinions.sourceRceptNo(),
                    rowsJson, fetchedAt);
        } catch (DuplicateKeyException e) {
            // 같은 요청이 동시에 넣었다. 그 결과를 둔다
        }
    }
}
