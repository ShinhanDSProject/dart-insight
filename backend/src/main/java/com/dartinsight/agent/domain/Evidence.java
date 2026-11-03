package com.dartinsight.agent.domain;

/**
 * Tool을 실행하며 backend가 저장된 자료로 만든 근거 위치 하나. 채팅 한 번 안에서 근거 ID → 위치 표로 들고 있다가,
 * 최종 답의 근거 ID가 이 표에 있는지 확인하고(ADR-0044) 응답의 citations를 만든다.
 *
 * @param side       previous, current. 근거 종류에 따라 null
 * @param quote      글 앞부분(화면 미리보기)
 * @param sentence   재무 계정 변화의 사실 문장(코드가 저장된 계산 결과로 만듦)
 */
public record Evidence(String evidenceId, Kind kind, String side, String rceptNo, Integer sectionNo, Integer blockNo,
        String sectionPath, String quote, Long changeId, String changeType, String sjDiv, String accountName,
        String sentence) {

    /** 화면 미리보기 길이(근거 질문의 quote와 같음) */
    public static final int QUOTE_CHARS = 160;

    public enum Kind {
        BLOCK, SECTION, TEXT_CHANGE, FINANCIAL_CHANGE
    }

    /** 원문 문단·표. 근거 ID는 저장된 원문 위치({접수번호}#B{블록 번호}) */
    public static Evidence block(String evidenceId, String side, String rceptNo, int sectionNo, int blockNo,
            String sectionPath, String text) {
        return new Evidence(evidenceId, Kind.BLOCK, side, rceptNo, sectionNo, blockNo, sectionPath, quote(text), null,
                null, null, null, null);
    }

    /** 원문 목차 항목 */
    public static Evidence section(String side, String rceptNo, int sectionNo, String sectionPath) {
        return new Evidence(sectionId(rceptNo, sectionNo), Kind.SECTION, side, rceptNo, sectionNo, null, sectionPath,
                null, null, null, null, null, null);
    }

    /** 문장 변경. rceptNo는 현재 쪽(삭제면 이전 쪽) */
    public static Evidence textChange(long changeId, String changeType, String rceptNo, String sectionPath,
            String text) {
        return new Evidence(textChangeId(changeId), Kind.TEXT_CHANGE, null, rceptNo, null, null, sectionPath,
                quote(text), changeId, changeType, null, null, null);
    }

    /** 재무 계정 변화. rceptNo는 현재 보고서 */
    public static Evidence financialChange(long changeId, String sjDiv, String accountName, String rceptNo,
            String sentence) {
        return new Evidence(financialChangeId(changeId), Kind.FINANCIAL_CHANGE, null, rceptNo, null, null, null, null,
                changeId, null, sjDiv, accountName, sentence);
    }

    public static String textChangeId(long changeId) {
        return "T" + changeId;
    }

    public static String financialChangeId(long changeId) {
        return "F" + changeId;
    }

    public static String sectionId(String rceptNo, int sectionNo) {
        return rceptNo + "#S" + sectionNo;
    }

    private static String quote(String text) {
        if (text == null) {
            return null;
        }
        return text.length() <= QUOTE_CHARS ? text : text.substring(0, QUOTE_CHARS);
    }
}
