package com.dartinsight.outlook.domain;

import com.dartinsight.report.domain.Report;
import java.util.Comparator;
import java.util.List;

/**
 * 보고서 하나의 회사가 밝힌 전망·계획(ADR-0039). {@code OutlookService.forReport}가 돌려주며 FS-60도 쓴다.
 *
 * @param report 원문 보고서. 사업보고서가 없으면 null
 * @param reason NOT_AVAILABLE일 때만
 * @param saved  AI가 만든 결과(저장한 것). AI를 부르지 않았으면(NOT_AVAILABLE, 낱말 문단 없는 EMPTY) null
 */
public record ReportOutlook(Report report, OutlookStatus status, OutlookUnavailableReason reason,
        OutlookRecord saved) {

    public static final String EMPTY_MESSAGE = "보고서 원문에서 회사가 밝힌 계획·전망 문장을 찾지 못했어요.";
    public static final String NOT_VERIFIED = "인용과 근거를 확인하지 못해 전망·계획을 보여 주지 않아요.";

    public static ReportOutlook notAvailable(Report report, OutlookUnavailableReason reason) {
        return new ReportOutlook(report, OutlookStatus.NOT_AVAILABLE, reason, null);
    }

    /** 계획·전망 낱말이 든 문단이 없어 AI를 부르지 않은 EMPTY */
    public static ReportOutlook noPlan(Report report) {
        return new ReportOutlook(report, OutlookStatus.EMPTY, null, null);
    }

    public static ReportOutlook of(Report report, OutlookRecord saved) {
        return new ReportOutlook(report, saved.status(), null, saved);
    }

    public boolean aiGenerated() {
        return saved != null;
    }

    /** 종류 순서(INVESTMENT → OTHER)로, 같은 종류 안에서는 AI가 낸 순서. GENERATED가 아니면 빈 목록 */
    public List<OutlookItem> items() {
        if (status != OutlookStatus.GENERATED || saved == null) {
            return List.of();
        }
        return saved.items().stream().sorted(Comparator.comparingInt(i -> i.category().ordinal())).toList();
    }

    /** 화면 안내. GENERATED면 null */
    public String message() {
        return switch (status) {
            case GENERATED -> null;
            case EMPTY -> EMPTY_MESSAGE;
            case REVIEW_NEEDED -> saved.reviewReason() == null ? NOT_VERIFIED : saved.reviewReason();
            case NOT_AVAILABLE -> reason.message();
        };
    }
}
