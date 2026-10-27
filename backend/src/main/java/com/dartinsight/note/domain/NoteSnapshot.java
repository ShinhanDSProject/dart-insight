package com.dartinsight.note.domain;

/**
 * 담을 때의 사본과 원래 위치(ADR-0034). backend가 저장된 분석 결과로 만든다.
 *
 * @param label      재무 '재무제표 · 계정명', 문장·AI 답 인용은 섹션 경로
 * @param text       재무 값 문장(코드가 만듦), 문장·AI 답 인용은 원문 문단 글
 * @param questionId AI 답 인용만. analysis_question.id
 * @param question   AI 답 인용만. 담을 때의 질문 글
 * @param side       AI 답 인용만. 근거 보고서가 분석의 current·previous 중 어느 쪽인지
 */
public record NoteSnapshot(String corpCode, NoteKind kind, Long analysisId, String analysisVersion, Long changeId,
        String sjDiv, String rceptNo, Integer sectionNo, Integer blockNo, String changeType, String label,
        String text, Long questionId, String question, String side) {

    public static final int MAX_LABEL = 1000;
    public static final int MAX_TEXT = 4000;
    public static final int MAX_QUESTION = 400;
    private static final String ELLIPSIS = "…";

    public NoteSnapshot {
        label = clip(label, MAX_LABEL);
        text = clip(text, MAX_TEXT);
        question = question == null ? null : clip(question, MAX_QUESTION);
    }

    /** 재무 계정 변화·문장 변경(질문 없음) */
    public NoteSnapshot(String corpCode, NoteKind kind, Long analysisId, String analysisVersion, Long changeId,
            String sjDiv, String rceptNo, Integer sectionNo, Integer blockNo, String changeType, String label,
            String text) {
        this(corpCode, kind, analysisId, analysisVersion, changeId, sjDiv, rceptNo, sectionNo, blockNo, changeType,
                label, text, null, null, null);
    }

    /** 열 길이를 넘으면 끝을 줄이고 '…'을 붙인다 */
    static String clip(String value, int max) {
        if (value.length() <= max) {
            return value;
        }
        int end = max - ELLIPSIS.length();
        // 이모지 같은 두 칸 문자를 반으로 자르지 않는다
        if (Character.isHighSurrogate(value.charAt(end - 1))) {
            end -= 1;
        }
        return value.substring(0, end) + ELLIPSIS;
    }
}
