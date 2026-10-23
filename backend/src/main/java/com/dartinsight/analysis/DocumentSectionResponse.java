package com.dartinsight.analysis;

import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.fasterxml.jackson.annotation.JsonRawValue;
import java.util.List;

/** 원문 목차 한 항목의 문단·표. */
public record DocumentSectionResponse(String side, String rceptNo, int sectionNo, String title, String sectionPath,
        List<BlockItem> blocks) {

    static DocumentSectionResponse of(String side, String rceptNo, DocumentSection section, String sectionPath,
            List<DocumentBlock> blocks) {
        return new DocumentSectionResponse(side, rceptNo, section.sectionNo(), section.title(), sectionPath,
                blocks.stream().map(BlockItem::from).toList());
    }

    /** table은 표 셀(JSON 그대로), 문단이면 null */
    public record BlockItem(int blockNo, String evidenceId, String type, String text, @JsonRawValue String table) {

        static BlockItem from(DocumentBlock block) {
            return new BlockItem(block.blockNo(), block.evidenceId(), block.type(), block.text(),
                    block.tableJson());
        }
    }
}
