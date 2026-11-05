package com.dartinsight.textevent.dto;

import java.util.List;

/** 주요 사건 요청(POST /internal/text-events, docs/api-spec.md 3장). */
public record TextEventAiRequest(String previousRceptNo, String currentRceptNo, Long equityTotal, String currency,
        String reportBaseDate, List<StructuredAmountItem> structuredAmounts, List<ChangeItem> changes) {

    public record StructuredAmountItem(String rceptNo, String kind, String field, long amount, String currency) {
    }

    /**
     * @param changedUnitCount   표는 바뀐 행 수, 행을 비교하지 못한 표와 표 아닌 변경은 1
     * @param precedingBlockText 표 바로 앞 블록의 글(단위 읽기). 표가 아니면 null
     */
    public record ChangeItem(int changeNo, String changeType, String blockType, String listGroup, String field,
            boolean raisedFromNote, String sectionPath, Integer previousBlockNo, Integer currentBlockNo,
            String previousText, String currentText, String precedingBlockText, int changedUnitCount) {
    }
}
