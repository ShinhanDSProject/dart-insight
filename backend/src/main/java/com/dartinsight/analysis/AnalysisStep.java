package com.dartinsight.analysis;

/** 분석 진행 단계(W-02). 앞 단계로 돌아가지 않는다. */
public enum AnalysisStep {
    RECEIVED("요청 접수"),
    COMPARING("보고서 비교"),
    VERIFYING("근거 확인"),
    DONE("완료");

    private final String label;

    AnalysisStep(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
