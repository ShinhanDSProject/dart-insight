package com.dartinsight.notification.dto;

import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.notification.service.NotificationService.NotificationView;
import com.dartinsight.report.domain.Report;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 알림 하나. 화면은 analysisId로 결과(/analyses/{analysisId})로 간다 */
public record NotificationResponse(
        long notificationId,
        long analysisId,
        String corpCode,
        String corpName,
        ComparisonBasis basis,
        ReportRef previous,
        ReportRef current,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime readAt) {

    public static NotificationResponse from(NotificationView view) {
        return new NotificationResponse(view.notification().getId(), view.analysis().getId(),
                view.analysis().getCorpCode(), view.company() == null ? null : view.company().getCorpName(),
                view.analysis().getBasis(), ReportRef.from(view.previous()), ReportRef.from(view.current()),
                view.notification().getCreatedAt(), view.notification().getReadAt());
    }

    public record ReportRef(String rceptNo, String reportName, LocalDate periodEnd) {

        static ReportRef from(Report report) {
            return report == null ? null : new ReportRef(report.getRceptNo(), report.getReportName(),
                    report.getPeriodEnd());
        }
    }
}
