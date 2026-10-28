package com.dartinsight.followup.domain;

/**
 * 계획 하나의 대조 상태(ADR-0041). 값은 ai-server app/followup/model.py와 같다. 이름은 평가가 아니라 중립 표현이다.
 */
public enum FollowupStatus {
    /** 올해 보고서가 같은 계획을 다시 언급하거나 진행 상황을 적음 */
    MENTIONED("관련 언급 있음"),
    /** 올해 보고서가 계획이 바뀌거나 중단·연기됐다고 적음 */
    CHANGED("계획 변경 언급"),
    /** 후보 문단에서 관련 문장을 찾지 못함(이행하지 않았다는 뜻이 아님) */
    NOT_FOUND("찾지 못함");

    private final String label;

    FollowupStatus(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** 올해 문단의 인용·근거가 있어야 하는 상태인지 */
    public boolean cited() {
        return this != NOT_FOUND;
    }

    /** AI 서버가 보낸 값. 모르는 값이면 null */
    public static FollowupStatus parse(String value) {
        for (FollowupStatus status : values()) {
            if (status.name().equals(value)) {
                return status;
            }
        }
        return null;
    }
}
