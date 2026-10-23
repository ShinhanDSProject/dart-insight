package com.dartinsight.document.repository;

import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.TableJson;
import com.dartinsight.document.dto.StructuredDocumentResponse.Block;
import com.dartinsight.document.dto.StructuredDocumentResponse.Section;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * 원문 목차·문단·표 저장. 보고서 하나에 수천 줄이라 JDBC 일괄 저장을 쓴다.
 * 바꿀 때는 그 원문의 행을 모두 지우고 다시 넣는다(부르는 쪽 트랜잭션 안에서).
 */
@Repository
@RequiredArgsConstructor
public class DocumentStore {

    private static final int BATCH = 500;
    private static final RowMapper<DocumentSection> SECTION = (rs, i) -> new DocumentSection(rs.getInt("section_no"),
            rs.getObject("parent_no", Integer.class), rs.getInt("depth"), rs.getString("title"),
            rs.getString("source_ref"), rs.getBoolean("cover"), rs.getInt("block_count"));

    private final JdbcTemplate jdbcTemplate;

    public void replace(long documentId, List<Section> sections) {
        delete(documentId);
        if (sections == null || sections.isEmpty()) {
            return;
        }
        List<Object[]> sectionRows = new ArrayList<>();
        List<Object[]> blockRows = new ArrayList<>();
        for (Section section : sections) {
            List<Block> blocks = section.blocks() == null ? List.of() : section.blocks();
            sectionRows.add(new Object[] {documentId, section.sectionNo(), section.parentNo(),
                    section.level() == null ? 0 : section.level(), limit(section.title(), 500),
                    limit(section.ref(), 50), Boolean.TRUE.equals(section.cover()), blocks.size()});
            for (Block block : blocks) {
                boolean table = DocumentBlock.TABLE.equals(block.type());
                blockRows.add(new Object[] {documentId, block.blockNo(), section.sectionNo(),
                        table ? DocumentBlock.TABLE : DocumentBlock.PARAGRAPH,
                        block.text() == null ? "" : block.text(), table ? TableJson.write(block.rows()) : null});
            }
        }
        insert("INSERT INTO document_section (document_id, section_no, parent_no, depth, title, source_ref, cover,"
                + " block_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", sectionRows);
        insert("INSERT INTO document_block (document_id, block_no, section_no, block_type, content, table_json)"
                + " VALUES (?, ?, ?, ?, ?, ?)", blockRows);
    }

    public void delete(long documentId) {
        jdbcTemplate.update("DELETE FROM document_block WHERE document_id = ?", documentId);
        jdbcTemplate.update("DELETE FROM document_section WHERE document_id = ?", documentId);
    }

    public List<DocumentSection> sections(long documentId) {
        return jdbcTemplate.query("SELECT section_no, parent_no, depth, title, source_ref, cover, block_count"
                + " FROM document_section WHERE document_id = ? ORDER BY section_no", SECTION, documentId);
    }

    /** 문서 전체 블록(문서 순서) */
    public List<DocumentBlock> blocks(long documentId, String rceptNo) {
        return jdbcTemplate.query("SELECT block_no, section_no, block_type, content, table_json FROM document_block"
                + " WHERE document_id = ? ORDER BY block_no", blockMapper(rceptNo), documentId);
    }

    public List<DocumentBlock> sectionBlocks(long documentId, String rceptNo, int sectionNo) {
        return jdbcTemplate.query("SELECT block_no, section_no, block_type, content, table_json FROM document_block"
                + " WHERE document_id = ? AND section_no = ? ORDER BY block_no", blockMapper(rceptNo), documentId,
                sectionNo);
    }

    public Optional<DocumentBlock> block(long documentId, String rceptNo, int blockNo) {
        return jdbcTemplate.query("SELECT block_no, section_no, block_type, content, table_json FROM document_block"
                + " WHERE document_id = ? AND block_no = ?", blockMapper(rceptNo), documentId, blockNo)
                .stream().findFirst();
    }

    private static RowMapper<DocumentBlock> blockMapper(String rceptNo) {
        return (rs, i) -> new DocumentBlock(rceptNo, rs.getInt("block_no"), rs.getInt("section_no"),
                rs.getString("block_type"), rs.getString("content"), rs.getString("table_json"));
    }

    private void insert(String sql, List<Object[]> rows) {
        for (int from = 0; from < rows.size(); from += BATCH) {
            jdbcTemplate.batchUpdate(sql, rows.subList(from, Math.min(rows.size(), from + BATCH)));
        }
    }

    private static String limit(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
