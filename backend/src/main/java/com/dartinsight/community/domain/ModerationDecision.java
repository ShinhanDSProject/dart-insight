package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;
import java.util.Arrays;

/** 관리자 처리 결정(community_moderation.decision). */
public enum ModerationDecision {
    KEEP(ReportStatus.KEPT),
    BLIND(ReportStatus.BLINDED),
    DELETE(ReportStatus.DELETED);

    private final ReportStatus reportStatus;

    ModerationDecision(ReportStatus reportStatus) {
        this.reportStatus = reportStatus;
    }

    /** 처리한 뒤 신고 건의 상태 */
    public ReportStatus reportStatus() {
        return reportStatus;
    }

    /** 요청 값. 문자열이 아니거나 세 값이 아니면 400(decision) */
    public static ModerationDecision of(Object raw) {
        return Arrays.stream(values())
                .filter(decision -> decision.name().equals(raw))
                .findFirst()
                .orElseThrow(() -> ApiException.invalidInput("decision", "KEEP, BLIND, DELETE 중 하나여야 합니다."));
    }
}
