package com.dartinsight.followup.dto;

import com.dartinsight.followup.domain.CompanyPlan;
import com.dartinsight.followup.domain.PlanCandidate;
import java.util.List;
import java.util.Map;

/** AI 서버 약속과 실제 대조 요청(POST /internal/plan-followups). docs/api-spec.md 3절 */
public record PlanFollowupAiRequest(String promptVersion, String companyName, String previousReportName,
        String currentReportName, List<Plan> plans) {

    /** @param candidates 계획 번호 → 올해 후보 문단 */
    public static PlanFollowupAiRequest of(String promptVersion, String companyName, String previousReportName,
            String currentReportName, List<CompanyPlan> plans, Map<Integer, List<PlanCandidate>> candidates) {
        return new PlanFollowupAiRequest(promptVersion, companyName, previousReportName, currentReportName,
                plans.stream().map(p -> new Plan(p.planId(), p.category().name(), p.summary(), p.quote(),
                        candidates.getOrDefault(p.planNo(), List.of()).stream()
                                .map(c -> new Source(c.evidenceId(), c.sectionPath(), c.text())).toList()))
                        .toList());
    }

    /** 작년 계획 하나와 올해 후보 문단 */
    public record Plan(String planId, String category, String summary, String quote, List<Source> candidates) {
    }

    /** 후보 문단 */
    public record Source(String evidenceId, String sectionPath, String text) {
    }
}
