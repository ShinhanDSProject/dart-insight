package com.dartinsight.analysis.domain;

import java.util.List;
import java.util.Map;

/**
 * 문장·표 변경의 목록 분류와 표 행 비교(ADR-0047). AI 서버가 비교할 때 정한 값을 그대로 저장한다.
 *
 * @param group          목록 묶음({@link #GROUPS})
 * @param field          분야({@link #FIELDS}). MAIN이 아니면 null
 * @param raisedFromNote 재무제표 주석에서 기본 목록으로 올린 변경인지
 * @param noteScope      주석이면 CONSOLIDATED, SEPARATE, UNKNOWN. 주석이 아니면 null
 * @param rowDiff        표 행 비교 결과. 비교하지 않았으면 null
 * @param version        분류 규칙 버전
 */
public record TextChangeListing(String group, String field, boolean raisedFromNote, String noteScope,
        RowDiff rowDiff, String version) {

    public static final String MAIN = "MAIN";
    public static final String NOTE = "NOTE";

    /** 모든 목록 묶음(건수 순서) */
    public static final List<String> GROUPS = List.of(MAIN, "HEADING", "FORMATTING", "PERIOD", "MOVED", NOTE,
            "PAIRED_TABLE", "UNPAIRED");

    /** 모든 분야(건수 순서) */
    public static final List<String> FIELDS = List.of("LITIGATION", "CONTRACT", "BUSINESS", "DIVIDEND", "FUNDING",
            "BOARD", "SHAREHOLDER", "AUDIT", "OTHER");

    /**
     * 표 행 비교 결과. 건수는 코드가 센 값이다.
     *
     * @param status         COMPARED, NOT_COMPARED(keyColumn·counts·pairedPrevious는 null, 나머지는 빈 목록)
     * @param pairedPrevious 구성이 바뀌어 DELETED로 잡힌 이전 표의 위치. 같은 변경 안에서 비교했으면 null
     */
    public record RowDiff(String status, String keyColumn, Counts counts, PairedPrevious pairedPrevious,
            List<ChangedRow> changedRows, List<String> addedKeys, List<String> missingKeys) {

        public record Counts(int changed, int added, int missing, int same) {
        }

        public record PairedPrevious(String rceptNo, int sectionNo, int blockNo) {
        }

        public record ChangedRow(String key, List<Cell> cells) {
        }

        public record Cell(String column, String previous, String current) {
        }
    }

    /**
     * 분석 전체의 분류 건수. 거르기와 상관없이 센다.
     *
     * @param fieldCounts   분야 → 기본 목록 건수. 합은 groupCounts의 MAIN과 같다
     * @param missingFields 두 보고서 어느 쪽에도 그 분야의 섹션이 없는 분야
     * @param groupCounts   묶음 → 건수
     */
    public record Summary(String version, Map<String, Integer> fieldCounts, List<String> missingFields,
            Map<String, Integer> groupCounts) {
    }
}
