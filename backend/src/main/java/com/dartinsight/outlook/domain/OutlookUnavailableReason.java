package com.dartinsight.outlook.domain;

/** 전망·계획을 만들 자료가 없는 사유(status NOT_AVAILABLE일 때만). */
public enum OutlookUnavailableReason {
    NO_REPORT("이 기업의 사업보고서가 없어 회사가 밝힌 전망·계획을 모을 수 없어요."),
    NO_DOCUMENT("보고서 원문을 받거나 읽지 못해 전망·계획을 모을 수 없어요."),
    NO_SOURCE("보고서 원문에서 '이사의 경영진단 및 분석의견'이나 '사업의 내용'의 설비·투자·연구개발 항목을 찾지 못했어요.");

    private final String message;

    OutlookUnavailableReason(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }
}
