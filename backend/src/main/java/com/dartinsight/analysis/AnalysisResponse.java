package com.dartinsight.analysis;

import com.dartinsight.comparison.ComparisonBasis;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.report.domain.FinancialDataStatus;
import com.dartinsight.report.dto.ReportItemResponse;
import com.dartinsight.report.service.ReportService.ReportDetail;
import com.dartinsight.summary.SummaryStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

public record AnalysisResponse(
        Long analysisId,
        String corpCode,
        String corpName,
        ComparisonBasis basis,
        FsDiv fsDiv,
        ReportItemResponse current,
        ReportItemResponse previous,
        AnalysisStatus status,
        AnalysisStep step,
        List<StepResponse> steps,
        ErrorInfo error,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime completedAt,
        TextStatus textStatus,
        String textMessage,
        SummaryStatus summaryStatus,
        String summaryMessage) {

    static AnalysisResponse of(Analysis a, ReportDetail current, ReportDetail previous,
            Map<String, FinancialDataStatus> statuses) {
        ErrorInfo error = a.getStatus() == AnalysisStatus.FAILED
                ? new ErrorInfo(a.getErrorCode(), a.getErrorMessage(), retryable(a.getErrorCode()))
                : null;
        return new AnalysisResponse(a.getId(), a.getCorpCode(), current.company().getCorpName(), a.getBasis(),
                a.getFsDiv(),
                ReportItemResponse.from(current.report(), statuses.get(current.report().getRceptNo())),
                ReportItemResponse.from(previous.report(), statuses.get(previous.report().getRceptNo())),
                a.getStatus(), a.getStep(), steps(a), error, a.getCreatedAt(), a.getCompletedAt(), a.getTextStatus(),
                a.getTextMessage(), a.getSummaryStatus(), a.getSummaryMessage());
    }

    /** 비교할 수 없는 쌍은 다시 요청해도 같으므로 다시 시도할 수 없다. 나머지는 다시 요청할 수 있다. */
    private static boolean retryable(String errorCode) {
        return !"ANALYSIS_NOT_COMPARABLE".equals(errorCode);
    }

    private static List<StepResponse> steps(Analysis a) {
        return Arrays.stream(AnalysisStep.values()).map(step -> {
            String state;
            if (a.getStatus() == AnalysisStatus.COMPLETED || step.ordinal() < a.getStep().ordinal()) {
                state = "DONE";
            } else if (step == a.getStep()) {
                state = a.getStatus() == AnalysisStatus.FAILED ? "FAILED" : "ACTIVE";
            } else {
                state = "PENDING";
            }
            return new StepResponse(step, step.label(), state);
        }).toList();
    }

    /** @param state DONE, ACTIVE, PENDING, FAILED */
    public record StepResponse(AnalysisStep step, String label, String state) {
    }

    public record ErrorInfo(String code, String message, boolean retryable) {
    }
}
