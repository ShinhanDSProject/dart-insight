package com.dartinsight.briefing.domain;

/** 브리핑을 만들 자료가 없는 사유(status NOT_AVAILABLE일 때만). */
public enum BriefingUnavailableReason {
    NO_REPORT("이 기업의 정기보고서가 없어 브리핑을 만들 수 없어요."),
    NO_DOCUMENT("보고서 원문을 받거나 읽지 못해 브리핑을 만들 수 없어요."),
    NO_SOURCE("보고서 원문에서 '사업의 내용' 항목을 찾지 못해 브리핑을 만들 수 없어요.");

    private final String message;

    BriefingUnavailableReason(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }
}
