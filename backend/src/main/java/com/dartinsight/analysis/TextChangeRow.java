package com.dartinsight.analysis;

import java.math.BigDecimal;

/**
 * 문장·표 변경 한 건(저장 전). 위치는 원문 구조화(4.2)의 섹션·블록 번호이고, 글은 저장된 원문에서 붙인다.
 *
 * @param changeType    ADDED, DELETED, MODIFIED, REVIEW_NEEDED
 * @param blockType     PARAGRAPH, TABLE, 짝을 정하지 못한 섹션이면 SECTION
 * @param numbersOnly   수정인데 숫자만 바뀜
 * @param sectionStatus 섹션 짝짓기 결과. MATCHED, RENAMED, ADDED, DELETED, AMBIGUOUS
 * @param previous      이전 보고서 쪽 위치·글. 추가면 null
 * @param current       현재 보고서 쪽 위치·글. 삭제면 null
 * @param similarity    수정일 때 두 글의 비슷한 정도(0~1)
 * @param reviewReason  검토 필요 사유
 */
public record TextChangeRow(String changeType, String blockType, boolean numbersOnly, String sectionStatus,
        String sectionTitle, String sectionPath, Side previous, Side current, BigDecimal similarity,
        String reviewReason) {

    public static final String ADDED = "ADDED";
    public static final String DELETED = "DELETED";
    public static final String MODIFIED = "MODIFIED";
    public static final String REVIEW_NEEDED = "REVIEW_NEEDED";
    public static final String SECTION = "SECTION";

    /** @param blockNo 섹션 단위 항목(검토 필요)이면 null */
    public record Side(String rceptNo, int sectionNo, Integer blockNo, String text) {
    }
}
