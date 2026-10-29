package com.dartinsight.checkpoint.domain;

import com.dartinsight.followup.domain.PlanFollowupReason;

/** 체크 포인트를 계산하지 않은 사유(docs/api-spec.md {@code reason}). 사업보고서 두 개를 고르는 규칙은 AnnualReportPair와 같다. */
public enum CheckpointReason {
    NO_REPORT("이 기업의 사업보고서가 없어 재무 체크 포인트를 계산할 수 없어요."),
    NO_PREVIOUS_REPORT("사업연도가 한 해 앞선 사업보고서가 없어 작년과 견주는 재무 체크 포인트를 계산할 수 없어요.");

    private final String message;

    CheckpointReason(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }

    /** AnnualReportPair가 알려 준 빠진 보고서 */
    public static CheckpointReason of(PlanFollowupReason missing) {
        return missing == PlanFollowupReason.NO_REPORT ? NO_REPORT : NO_PREVIOUS_REPORT;
    }
}
