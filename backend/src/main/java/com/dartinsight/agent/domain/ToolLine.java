package com.dartinsight.agent.domain;

/**
 * Tool 결과의 한 줄. text는 backend가 저장된 자료로 만든 글이고 ai-server에 그대로 간다.
 *
 * @param evidence 답의 근거로 쓸 수 있는 위치. 근거로 쓰지 않는 줄이면 null
 * @param facts    코드가 판정에 쓰는 구조화 값(교차 검증). 해당하지 않는 줄이면 null
 */
public record ToolLine(Evidence evidence, String text, Facts facts) {

    public ToolLine(Evidence evidence, String text) {
        this(evidence, text, null);
    }

    public String evidenceId() {
        return evidence == null ? null : evidence.evidenceId();
    }

    /** 저장된 재무 설명 등급. ai-server 검토 노드가 등급을 바꾼 답을 반려하는 데 쓴다 */
    public String grade() {
        return evidence == null ? null : evidence.grade();
    }

    public ToolLine withEvidence(Evidence changed) {
        return new ToolLine(changed, text, facts);
    }

    public ToolLine withText(String changed) {
        return new ToolLine(evidence, changed, facts);
    }

    /**
     * 판정용 구조화 값(docs/api-spec.md 3절 items[].facts). 재무 줄은 세 값 모두, 요약 줄·인용 줄은 changeId만.
     *
     * @param direction  UP·DOWN·SAME. 계산하지 못하면 null
     * @param calcStatus 재무 수치 변화 API의 calcStatus
     */
    public record Facts(Long changeId, String direction, String calcStatus) {

        public static Facts change(Long changeId) {
            return new Facts(changeId, null, null);
        }
    }
}
