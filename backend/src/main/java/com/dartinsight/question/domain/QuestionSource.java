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
}
