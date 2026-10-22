package com.dartinsight.document;

/**
 * 원문 문단 또는 표 하나. 블록 번호는 문서 전체에서 순서대로 1부터이며 원문 위치(근거 ID)의 기준이다.
 *
 * @param type      PARAGRAPH 또는 TABLE
 * @param text      문단 글. 표는 행마다 한 줄, 셀은 " | "로 이은 글
 * @param tableJson 표 셀(JSON 문자열, {@link TableJson}). 문단이면 null
 */
public record DocumentBlock(String rceptNo, int blockNo, int sectionNo, String type, String text, String tableJson) {

    public static final String PARAGRAPH = "PARAGRAPH";
    public static final String TABLE = "TABLE";

    /** 근거 ID. 접수번호와 블록 번호(예: 20260814001234#B123) */
    public String evidenceId() {
        return evidenceId(rceptNo, blockNo);
    }

    public static String evidenceId(String rceptNo, int blockNo) {
        return rceptNo + "#B" + blockNo;
    }
}
