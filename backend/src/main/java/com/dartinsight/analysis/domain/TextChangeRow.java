package com.dartinsight.analysis.domain;

import java.math.BigDecimal;
import java.util.List;

/**
 * 문장·표 변경 한 건(저장 전). 위치는 원문 구조화(4.2)의 섹션·블록 번호이고, 글은 저장된 원문에서 붙인다.
 *
 * @param changeType          ADDED, DELETED, MODIFIED, NUMERIC_UPDATE(숫자만 바뀜), MOVED(위치 이동), REVIEW_NEEDED
 * @param blockType           PARAGRAPH, TABLE, 짝을 정하지 못한 섹션이면 SECTION
 * @param numbersOnly         숫자만 바뀜. 분석 버전 m2-9부터는 NUMERIC_UPDATE일 때만 true(옛 결과는 MODIFIED에 true)
 * @param sectionStatus       섹션 짝짓기 결과. MATCHED, RENAMED, ADDED, DELETED, AMBIGUOUS
 * @param sectionPath         상위부터 이은 섹션 제목. 위치 이동이면 현재 쪽
 * @param previous            이전 보고서 쪽 위치·글. 추가면 null
 * @param current             현재 보고서 쪽 위치·글. 삭제면 null
 * @param similarity          수정·숫자만 바뀜·위치 이동일 때 두 글의 비슷한 정도(0~1)
 * @param reviewReason        검토 필요 사유
 * @param priority            확인 우선순위(2.6). 규칙으로 판단할 수 없으면 UNRANKED
 * @param previousSectionPath 위치 이동일 때 이전 쪽 섹션 경로. 그 밖은 null
 */
public record TextChangeRow(String changeType, String blockType, boolean numbersOnly, String sectionStatus,
        String sectionTitle, String sectionPath, Side previous, Side current, BigDecimal similarity,
        String reviewReason, Priority priority, String previousSectionPath) {

    /** 위치 이동이 아닌 변경(이전 쪽 섹션 경로 없음) */
    public TextChangeRow(String changeType, String blockType, boolean numbersOnly, String sectionStatus,
            String sectionTitle, String sectionPath, Side previous, Side current, BigDecimal similarity,
            String reviewReason, Priority priority) {
        this(changeType, blockType, numbersOnly, sectionStatus, sectionTitle, sectionPath, previous, current,
                similarity, reviewReason, priority, null);
    }

    /** 우선순위를 아직 매기지 않은 변경 */
    public TextChangeRow(String changeType, String blockType, boolean numbersOnly, String sectionStatus,
            String sectionTitle, String sectionPath, Side previous, Side current, BigDecimal similarity,
            String reviewReason) {
        this(changeType, blockType, numbersOnly, sectionStatus, sectionTitle, sectionPath, previous, current,
                similarity, reviewReason, null, null);
    }

    public static final String ADDED = "ADDED";
    public static final String DELETED = "DELETED";
    public static final String MODIFIED = "MODIFIED";
    /** 수정인데 숫자만 바뀜(숫자를 가린 글이 같음) */
    public static final String NUMERIC_UPDATE = "NUMERIC_UPDATE";
    /** 같은 글이 다른 자리(같은 섹션 안 다른 순서나 다른 섹션)로 옮겨짐. 두 쪽 위치가 모두 있다 */
    public static final String MOVED = "MOVED";
    public static final String REVIEW_NEEDED = "REVIEW_NEEDED";
    public static final String SECTION = "SECTION";

    /** 모든 변경 유형(목록 거르기·건수 순서) */
    public static final List<String> TYPES = List.of(ADDED, DELETED, MODIFIED, NUMERIC_UPDATE, MOVED,
            REVIEW_NEEDED);

    /** @param blockNo 섹션 단위 항목(검토 필요)이면 null */
    public record Side(String rceptNo, int sectionNo, Integer blockNo, String text) {
    }

    /**
     * 확인 우선순위. 확인할 순서이며 투자 판단이 아니다.
     *
     * @param level   HIGH, MEDIUM, LOW, 판단 유보면 UNRANKED
     * @param score   규칙 점수 합. UNRANKED면 null
     * @param reasons 적용한 규칙
     * @param version 규칙 버전(잠정 규칙이 바뀌면 올림)
     */
    public record Priority(String level, Integer score, List<String> reasons, String version) {

        public static final String UNRANKED = "UNRANKED";
    }
}
