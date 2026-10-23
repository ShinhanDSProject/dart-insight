package com.dartinsight.analysis;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.report.FinancialDataStatus;
import com.dartinsight.report.ReportService;
import com.dartinsight.report.ReportService.ReportDetail;
import jakarta.validation.Valid;
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
        return ResponseEntity.status(result.completed() ? HttpStatus.OK : HttpStatus.ACCEPTED)
                .body(AnalysisCreatedResponse.from(result));
    }

    @GetMapping(ApiPaths.BY_ANALYSIS_ID)
    public AnalysisResponse get(@PathVariable Long analysisId) {
        Analysis a = resultService.get(analysisId);
        ReportDetail current = reportService.get(a.getCurrentRceptNo());
        ReportDetail previous = reportService.get(a.getPreviousRceptNo());
        Map<String, FinancialDataStatus> statuses = reportService.financialDataStatuses(a.getCorpCode(),
                List.of(current.report(), previous.report()));
        return AnalysisResponse.of(a, current, previous, statuses);
    }
}
