package com.dartinsight.followup.dto;

import com.dartinsight.followup.domain.FollowupStatus;
import com.dartinsight.followup.domain.PlanFollowupItem;
import com.dartinsight.followup.domain.PlanFollowupReason;
import com.dartinsight.followup.domain.PlanFollowupRecord;
import com.dartinsight.followup.domain.PlanFollowupResult;
import com.dartinsight.followup.domain.PlanFollowupStatus;
import com.dartinsight.outlook.domain.OutlookCategory;
import com.dartinsight.outlook.domain.OutlookItem;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 약속과 실제 대조(docs/api-spec.md GET /api/companies/{corpCode}/plan-followups).
 *
 * @param reason         대조를 만들지 않았을 때 사유. 아니면 null
 * @param message        GENERATED가 아니면 안내. GENERATED면 null
 * @param previousReport 작년 사업보고서. 없으면 null
 * @param currentReport  올해 사업보고서. 없으면 null
 * @param aiGenerated    AI가 만든 대조면 true(화면 'AI 생성')
 * @param ai             AI가 만든 대조일 때만 모델·프롬프트 버전·생성 시각
 */
public record CompanyPlanFollowupResponse(String corpCode, PlanFollowupStatus status, PlanFollowupReason reason,
        String message, ReportRef previousReport, ReportRef currentReport, List<Item> items, boolean aiGenerated,
        AiInfo ai) {

    public static CompanyPlanFollowupResponse of(String corpCode, PlanFollowupResult result) {
        PlanFollowupRecord saved = result.saved();
        return new CompanyPlanFollowupResponse(corpCode, result.status(), result.reason(), result.message(),
                ReportRef.from(result.previous()), ReportRef.from(result.current()),
                result.items().stream().map(Item::from).toList(), result.aiGenerated(),
                saved == null ? null : new AiInfo(saved.model(), saved.promptVersion(), saved.generatedAt()));
    }

    public record ReportRef(String rceptNo, String reportName, ReportType reportType, String dartUrl) {

        static ReportRef from(Report report) {
            return report == null ? null : new ReportRef(report.getRceptNo(), report.getReportName(),
                    report.getReportType(), DartLinks.viewer(report.getRceptNo()));
        }
    }

    public record Item(int planNo, OutlookCategory category, String categoryLabel, Plan plan, Followup followup) {

        static Item from(PlanFollowupItem item) {
            PlanFollowupItem.FollowupSide side = item.followup();
            return new Item(item.planNo(), item.category(), item.category().label(),
                    new Plan(item.plan().summary(), item.plan().quote(), item.plan().evidence()),
                    new Followup(side.status(), side.status().label(), side.summary(), side.quote(),
                            side.evidence()));
        }
    }

    /** 작년 계획 */
    public record Plan(String summary, String quote, OutlookItem.Evidence evidence) {
    }

    /** 올해 관련 문단. NOT_FOUND면 summary·quote·evidence는 null */
    public record Followup(FollowupStatus status, String statusLabel, String summary, String quote,
            OutlookItem.Evidence evidence) {
    }

    public record AiInfo(String model, String promptVersion,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime generatedAt) {
    }
}
