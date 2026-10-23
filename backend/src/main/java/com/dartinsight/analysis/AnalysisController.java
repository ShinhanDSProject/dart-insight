package com.dartinsight.analysis;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.comparison.ComparisonBasis;
import com.dartinsight.financial.FsDiv;
import com.dartinsight.report.FinancialDataStatus;
import com.dartinsight.report.ReportItemResponse;
import com.dartinsight.report.ReportService;
import com.dartinsight.report.ReportService.ReportDetail;
import com.dartinsight.summary.SummaryStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 분석 요청·상태 API(docs/api-spec.md). 화면 W-01 ③ → W-02 → W-03.
 */
@RestController
@RequestMapping(ApiPaths.ANALYSES)
public class AnalysisController {

    private final AnalysisService analysisService;
    private final AnalysisResultService resultService;
    private final ReportService reportService;

    public AnalysisController(AnalysisService analysisService, AnalysisResultService resultService,
            ReportService reportService) {
        this.analysisService = analysisService;
        this.resultService = resultService;
        this.reportService = reportService;
    }

    /** 새 분석이나 진행 중인 분석은 202, 완료된 결과를 다시 쓰면 200 */
    @PostMapping
    public ResponseEntity<AnalysisCreatedResponse> request(@Valid @RequestBody AnalysisRequest request) {
        AnalysisService.RequestResult result = analysisService.request(request.corpCode(), request.currentRceptNo(),
                request.previousRceptNo(), request.basis());
        Analysis a = result.analysis();
        return ResponseEntity.status(result.completed() ? HttpStatus.OK : HttpStatus.ACCEPTED)
                .body(new AnalysisCreatedResponse(a.getId(), a.getStatus(), a.getStep(), result.reused()));
    }

    @GetMapping(ApiPaths.BY_ANALYSIS_ID)
    public AnalysisResponse get(@PathVariable Long analysisId) {
        Analysis a = resultService.get(analysisId);
        ReportDetail current = reportService.get(a.getCurrentRceptNo());
        ReportDetail previous = reportService.get(a.getPreviousRceptNo());
        Map<String, FinancialDataStatus> statuses = reportService.financialDataStatuses(a.getCorpCode(),
                List.of(current.report(), previous.report()));
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
    static boolean retryable(String errorCode) {
        return !"ANALYSIS_NOT_COMPARABLE".equals(errorCode);
    }

    static List<StepResponse> steps(Analysis a) {
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

    public record AnalysisRequest(
            @NotBlank(message = "기업 고유번호가 필요합니다.") String corpCode,
            @NotBlank(message = "현재 보고서 접수번호가 필요합니다.") String currentRceptNo,
            @NotBlank(message = "비교 보고서 접수번호가 필요합니다.") String previousRceptNo,
            @NotNull(message = "비교 기준이 필요합니다.") ComparisonBasis basis) {
    }

    public record AnalysisCreatedResponse(Long analysisId, AnalysisStatus status, AnalysisStep step, boolean reused) {
    }

    /** @param state DONE, ACTIVE, PENDING, FAILED */
    public record StepResponse(AnalysisStep step, String label, String state) {
    }

    public record ErrorInfo(String code, String message, boolean retryable) {
    }

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
    }
}
