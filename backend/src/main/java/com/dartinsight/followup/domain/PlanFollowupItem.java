package com.dartinsight.followup.domain;

import com.dartinsight.outlook.domain.OutlookCategory;
import com.dartinsight.outlook.domain.OutlookItem;

/**
 * 계획 하나의 대조. plan_followup.items에 JSON 배열로 저장한다(docs/erd.md).
 *
 * @param plan     작년 보고서의 계획(요지·인용·근거 위치)
 * @param followup 올해 보고서의 관련 문단
 */
public record PlanFollowupItem(int planNo, OutlookCategory category, PlanSide plan, FollowupSide followup) {

    public static PlanFollowupItem of(CompanyPlan plan, FollowupSide followup) {
        return new PlanFollowupItem(plan.planNo(), plan.category(),
                new PlanSide(plan.summary(), plan.quote(), plan.evidence()), followup);
    }

    /** 작년 계획 */
    public record PlanSide(String summary, String quote, OutlookItem.Evidence evidence) {
    }

    /**
     * 올해 관련 문단. NOT_FOUND면 summary·quote·evidence는 null
     *
     * @param quote    올해 원문 글 그대로(이어진 공백은 한 칸)
     * @param evidence quote가 든 올해 원문 위치
     */
    public record FollowupSide(FollowupStatus status, String summary, String quote, OutlookItem.Evidence evidence) {

        public static FollowupSide notFound() {
            return new FollowupSide(FollowupStatus.NOT_FOUND, null, null, null);
        }
    }
}
