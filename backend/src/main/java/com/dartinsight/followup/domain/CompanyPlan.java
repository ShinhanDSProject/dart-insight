package com.dartinsight.followup.domain;

import com.dartinsight.outlook.domain.OutlookCategory;
import com.dartinsight.outlook.domain.OutlookItem;
import com.dartinsight.outlook.domain.OutlookStatus;
import com.dartinsight.outlook.domain.ReportOutlook;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 작년 사업보고서에서 회사가 밝힌 행동 계획 하나(FS-59 전망·계획 항목 중 시장·업황 전망을 뺀 것, ADR-0041).
 *
 * @param planNo   1부터. 작년 전망·계획 순서
 * @param summary  FS-59 AI 요지
 * @param quote    작년 원문 인용
 * @param evidence 작년 원문 위치
 */
public record CompanyPlan(int planNo, OutlookCategory category, String summary, String quote,
        OutlookItem.Evidence evidence) {

    /** AI 서버에 보내는 계획 id */
    public String planId() {
        return "P" + planNo;
    }

    /** 회사가 할 일인 종류만 계획이다. 시장·업황 전망은 약속이 아니다 */
    public static boolean actionable(OutlookCategory category) {
        return category != OutlookCategory.MARKET;
    }

    /** 작년 전망·계획에서 회사 행동 계획만 순서대로 */
    public static List<CompanyPlan> from(ReportOutlook outlook) {
        List<CompanyPlan> plans = new ArrayList<>();
        for (OutlookItem item : outlook.items()) {
            if (actionable(item.category())) {
                plans.add(new CompanyPlan(plans.size() + 1, item.category(), item.summary(), item.quote(),
                        item.evidence()));
            }
        }
        return plans;
    }

    /** 작년 전망·계획 결과만으로 대조를 끝내야 하면 그 사유. 계획이 있으면 empty */
    public static Optional<PlanFollowupReason> stop(ReportOutlook outlook) {
        if (outlook.status() == OutlookStatus.NOT_AVAILABLE) {
            return Optional.of(PlanFollowupReason.NO_PREVIOUS_SOURCE);
        }
        if (outlook.status() == OutlookStatus.REVIEW_NEEDED) {
            return Optional.of(PlanFollowupReason.PREVIOUS_REVIEW_NEEDED);
        }
        return from(outlook).isEmpty() ? Optional.of(PlanFollowupReason.NO_PREVIOUS_PLAN) : Optional.empty();
    }
}
