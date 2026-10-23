package com.dartinsight.analysis.dto;

import java.util.List;

/** AI 서버 문장 비교 요청(POST /internal/text-changes). 두 원문의 목차와 블록 글을 보낸다. */
public record TextChangeRequest(Document previous, Document current) {

    public record Document(String rceptNo, List<Section> sections, List<Block> blocks) {
    }

    public record Section(int sectionNo, Integer parentNo, int level, String title, boolean cover) {
    }

    public record Block(int blockNo, int sectionNo, String type, String text) {
    }
}
