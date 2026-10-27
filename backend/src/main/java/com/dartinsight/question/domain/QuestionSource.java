package com.dartinsight.question.domain;

/**
 * 질문의 후보 문단(원문 블록 하나).
 *
 * @param evidenceId  근거 ID({접수번호}#B{블록 번호})
 * @param side        current 또는 previous
 * @param sectionPath 상위 섹션부터 이은 제목. 모르면 빈 글
 * @param text        문단 글(후보로 보낼 때는 잘린 글일 수 있음)
 */
public record QuestionSource(String evidenceId, String side, String rceptNo, Integer sectionNo, Integer blockNo,
        String sectionPath, String text) {

    public static final String CURRENT = "current";
    public static final String PREVIOUS = "previous";

    /** 원문에서 블록을 찾지 못한 근거. 섹션·글 없이 아는 위치만 둔다 */
    public static QuestionSource unresolved(String evidenceId, String side, String rceptNo, Integer blockNo) {
        return new QuestionSource(evidenceId, side, rceptNo, null, blockNo, null, null);
    }

    /** 분석의 현재 보고서면 current, 비교 보고서면 previous, 둘 다 아니면 null */
    public static String sideOf(String rceptNo, String currentRceptNo, String previousRceptNo) {
        return rceptNo.equals(currentRceptNo) ? CURRENT : rceptNo.equals(previousRceptNo) ? PREVIOUS : null;
    }

    /** 분석의 한쪽 보고서에서 섹션과 글까지 찾은 문단인지(판단 노트에 담을 수 있는지) */
    public boolean hasParagraph() {
        return side != null && sectionNo != null && text != null && !text.isBlank();
    }
}
