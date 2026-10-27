package com.dartinsight.question.domain;

/**
 * 근거 ID({접수번호}#B{블록 번호})를 나눈 값. 저장된 근거 ID를 원문 위치로 다시 풀 때 쓴다.
 *
 * @param rceptNo 근거 ID에 '#B'가 없으면 null
 * @param blockNo '#B'가 없거나 그 뒤가 숫자가 아니면 null
 */
public record EvidenceRef(String rceptNo, Integer blockNo) {

    private static final String BLOCK_MARK = "#B";

    public static EvidenceRef parse(String evidenceId) {
        int mark = evidenceId.indexOf(BLOCK_MARK);
        if (mark < 0) {
            return new EvidenceRef(null, null);
        }
        String rceptNo = evidenceId.substring(0, mark);
        try {
            return new EvidenceRef(rceptNo, Integer.valueOf(evidenceId.substring(mark + BLOCK_MARK.length())));
        } catch (NumberFormatException e) {
            return new EvidenceRef(rceptNo, null);
        }
    }
}
