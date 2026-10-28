package com.dartinsight.followup.domain;

import com.dartinsight.report.domain.Report;
import java.util.List;

/**
 * 두 사업보고서의 약속과 실제 대조(ADR-0041).
 *
 * @param previous 작년 사업보고서. 없으면 null
 * @param current  올해 사업보고서. 없으면 null
 * @param reason   대조를 만들지 않았을 때만
 * @param saved    AI가 만든 대조(저장한 것). 만들지 않았으면 null
 */
public record PlanFollowupResult(Report previous, Report current, PlanFollowupStatus status,
        PlanFollowupReason reason, PlanFollowupRecord saved) {

    public static final String NOT_VERIFIED = "근거와 인용을 확인하지 못해 대조 결과를 보여 주지 않아요.";

    /** 대조를 만들지 않고 끝냄. 상태는 사유가 정한다 */
    public static PlanFollowupResult stopped(Report previous, Report current, PlanFollowupReason reason) {
        return new PlanFollowupResult(previous, current, reason.status(), reason, null);
    }

    public static PlanFollowupResult of(Report previous, Report current, PlanFollowupRecord saved) {
        return new PlanFollowupResult(previous, current, saved.status(), null, saved);
    }

    public boolean aiGenerated() {
        return saved != null;
    }

    /** 계획 순서. GENERATED가 아니면 빈 목록 */
    public List<PlanFollowupItem> items() {
        return status == PlanFollowupStatus.GENERATED && saved != null ? saved.items() : List.of();
    }

    /** 화면 안내. GENERATED면 null */
    public String message() {
        if (status == PlanFollowupStatus.GENERATED) {
            return null;
        }
        if (reason != null) {
            return reason.message();
        }
        return saved == null || saved.reviewReason() == null ? NOT_VERIFIED : saved.reviewReason();
    }
}
