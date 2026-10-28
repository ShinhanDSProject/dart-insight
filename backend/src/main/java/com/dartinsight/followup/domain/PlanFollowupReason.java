package com.dartinsight.followup.domain;

/** 대조를 만들지 않은 사유와 그때의 상태(ADR-0041). 대조를 만들었으면 사유는 없다. */
public enum PlanFollowupReason {
    NO_REPORT(PlanFollowupStatus.NOT_AVAILABLE,
            "이 기업의 사업보고서가 없어 작년 계획과 올해 보고서를 나란히 볼 수 없어요."),
    NO_PREVIOUS_REPORT(PlanFollowupStatus.NOT_AVAILABLE,
            "사업연도가 한 해 앞선 사업보고서가 없어 작년 계획과 나란히 볼 수 없어요."),
    NO_PREVIOUS_SOURCE(PlanFollowupStatus.NOT_AVAILABLE,
            "작년 사업보고서 원문에서 회사가 밝힌 계획을 모을 수 없었어요."),
    NO_DOCUMENT(PlanFollowupStatus.NOT_AVAILABLE, "올해 사업보고서 원문을 받거나 읽지 못했어요."),
    NO_CURRENT_SOURCE(PlanFollowupStatus.NOT_AVAILABLE, "올해 사업보고서 원문에서 나란히 볼 문단을 찾지 못했어요."),
    NO_PREVIOUS_PLAN(PlanFollowupStatus.EMPTY,
            "작년 사업보고서에서 회사가 밝힌 투자·사업·재무 계획을 찾지 못했어요."),
    PREVIOUS_REVIEW_NEEDED(PlanFollowupStatus.REVIEW_NEEDED,
            "작년 사업보고서의 전망·계획이 검토 필요라 올해 보고서와 나란히 놓지 않았어요.");

    private final PlanFollowupStatus status;
    private final String message;

    PlanFollowupReason(PlanFollowupStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public PlanFollowupStatus status() {
        return status;
    }

    public String message() {
        return message;
    }
}
