package com.dartinsight.outlook.dto;

import com.dartinsight.outlook.domain.OutlookCategory;
import com.dartinsight.outlook.domain.OutlookItem;
import com.dartinsight.outlook.domain.OutlookRecord;
import com.dartinsight.outlook.domain.OutlookStatus;
import com.dartinsight.outlook.domain.OutlookUnavailableReason;
import com.dartinsight.outlook.domain.ReportOutlook;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.domain.ReportType;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 회사가 밝힌 전망·계획(docs/api-spec.md GET /api/companies/{corpCode}/outlook).
 *
 * @param reason      NOT_AVAILABLE일 때 사유. 아니면 null
 * @param message     GENERATED가 아니면 안내. GENERATED면 null
 * @param report      원문 보고서. 사업보고서가 없으면 null
 * @param aiGenerated AI가 만든 결과면 true(화면 'AI 생성')
 * @param ai          AI가 만든 결과일 때만 모델·프롬프트 버전·생성 시각
 */
public record CompanyOutlookResponse(String corpCode, OutlookStatus status, OutlookUnavailableReason reason,
        String message, ReportRef report, List<Item> items, boolean aiGenerated, AiInfo ai) {

    public static CompanyOutlookResponse of(String corpCode, ReportOutlook outlook) {
        List<Item> items = new ArrayList<>();
        for (OutlookItem item : outlook.items()) {
            items.add(new Item(items.size() + 1, item.category(), item.category().label(), item.summary(),
                    item.quote(), item.evidence()));
        }
        OutlookRecord saved = outlook.saved();
        return new CompanyOutlookResponse(corpCode, outlook.status(), outlook.reason(), outlook.message(),
                outlook.report() == null ? null : ReportRef.from(outlook.report()), items, outlook.aiGenerated(),
                saved == null ? null : new AiInfo(saved.model(), saved.promptVersion(), saved.generatedAt()));
    }

    public record ReportRef(String rceptNo, String reportName, ReportType reportType, String dartUrl) {

        static ReportRef from(Report report) {
            return new ReportRef(report.getRceptNo(), report.getReportName(), report.getReportType(),
                    DartLinks.viewer(report.getRceptNo()));
        }
    }

    public record Item(int no, OutlookCategory category, String categoryLabel, String summary, String quote,
            OutlookItem.Evidence evidence) {
    }

    public record AiInfo(String model, String promptVersion,
            @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime generatedAt) {
    }
}
