package com.dartinsight.disclosure.repository;

import com.dartinsight.disclosure.domain.DisclosureKeyItems;
import com.dartinsight.disclosure.domain.KeyItem;
import com.dartinsight.disclosure.domain.KeyItemKind;
import com.dartinsight.disclosure.domain.KeyItemStatus;
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
 * 주요사항보고서 핵심 수치 저장(disclosure_key_item, docs/erd.md). 공시마다 한 행이고 항목 목록은 JSON 배열 한 칸에 둔다.
 * 저장하는 상태는 OK(자료 있음)와 NO_DATA뿐이다. 호출 실패는 저장하지 않는다.
 */
@Repository
@RequiredArgsConstructor
public class DisclosureKeyItemStore {

    private static final String OK = "OK";

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public Optional<DisclosureKeyItems> find(String rceptNo) {
        JavaType listType = jsonMapper.getTypeFactory().constructCollectionType(List.class, KeyItem.class);
        return jdbcTemplate.query("SELECT kind, status, items_json, fetched_at, source_rcept_no"
                + " FROM disclosure_key_item WHERE rcept_no = ?", (rs, i) -> new DisclosureKeyItems(
                        rceptNo,
                        KeyItemKind.valueOf(rs.getString("kind")),
                        OK.equals(rs.getString("status")) ? KeyItemStatus.AVAILABLE : KeyItemStatus.NO_DATA,
                        jsonMapper.readValue(rs.getString("items_json"), listType),
                        rs.getTimestamp("fetched_at").toLocalDateTime(),
                        rs.getString("source_rcept_no")), rceptNo)
                .stream().findFirst();
    }

    /** 저장된 행이 있으면 바꾸고, 없으면 넣는다. 같은 공시를 동시에 넣었으면 먼저 넣은 결과를 둔다. */
    public void save(DisclosureKeyItems keyItems) {
        String status = keyItems.status() == KeyItemStatus.AVAILABLE ? OK : KeyItemStatus.NO_DATA.name();
        String itemsJson = jsonMapper.writeValueAsString(keyItems.items());
        Timestamp fetchedAt = Timestamp.valueOf(keyItems.fetchedAt());
        int updated = jdbcTemplate.update("UPDATE disclosure_key_item SET kind = ?, status = ?, items_json = ?,"
                + " fetched_at = ?, source_rcept_no = ? WHERE rcept_no = ?", keyItems.kind().name(), status,
                itemsJson, fetchedAt, keyItems.sourceRceptNo(), keyItems.rceptNo());
        if (updated > 0) {
            return;
        }
        try {
            jdbcTemplate.update("INSERT INTO disclosure_key_item (rcept_no, kind, status, items_json, fetched_at,"
                    + " source_rcept_no) VALUES (?, ?, ?, ?, ?, ?)", keyItems.rceptNo(), keyItems.kind().name(),
                    status, itemsJson, fetchedAt, keyItems.sourceRceptNo());
        } catch (DuplicateKeyException e) {
            // 같은 요청이 동시에 넣었다. 그 결과를 둔다
        }
    }
}
