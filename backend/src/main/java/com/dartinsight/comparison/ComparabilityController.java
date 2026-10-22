package com.dartinsight.comparison;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.comparison.ComparabilityService.ComparabilityResult;
import com.dartinsight.comparison.StatementRules.StatementRule;
import com.dartinsight.financial.FsDiv;
import com.dartinsight.report.FinancialDataStatus;
import com.dartinsight.report.Report;
import com.dartinsight.report.ReportController.ReportItemResponse;
import com.dartinsight.report.ReportService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 비교 가능성 검증 API(docs/api-spec.md). 화면 W-01 ③.
 * 비교할 수 없어도 200으로 결과를 돌려준다(분석 요청만 422).
 */
@RestController
@RequestMapping(ApiPaths.COMPARABILITY_CHECKS)
public class ComparabilityController {

    private final ComparabilityService comparabilityService;
    private final ReportService reportService;

    public ComparabilityController(ComparabilityService comparabilityService, ReportService reportService) {
        this.comparabilityService = comparabilityService;
        this.reportService = reportService;
    }

    @PostMapping
    public ComparabilityResponse check(@Valid @RequestBody ComparabilityRequest request) {
        ComparabilityResult result = comparabilityService.check(request.corpCode(), request.currentRceptNo(),
                request.previousRceptNo(), request.basis());
        return ComparabilityResponse.from(result, reportService.financialDataStatuses(request.corpCode(),
                List.of(result.current(), result.previous())));
    }

    public record ComparabilityRequest(
            @NotBlank(message = "기업 고유번호가 필요합니다.") String corpCode,
            @NotBlank(message = "현재 보고서 접수번호가 필요합니다.") String currentRceptNo,
            @NotBlank(message = "비교 보고서 접수번호가 필요합니다.") String previousRceptNo,
            @NotNull(message = "비교 기준이 필요합니다.") ComparisonBasis basis) {
    }

    public record ComparabilityResponse(
            boolean comparable,
            ComparabilityService.Level level,
            FsDiv fsDiv,
            ReportItemResponse current,
            ReportItemResponse previous,
            List<StatementResponse> statements,
            List<CheckResponse> checks,
            List<ComparabilityService.Reason> reasons) {

        static ComparabilityResponse from(ComparabilityResult r, Map<String, FinancialDataStatus> statuses) {
            return new ComparabilityResponse(r.comparable(), r.level(), r.fsDiv(), item(r.current(), statuses),
                    item(r.previous(), statuses),
                    r.statements().stream().map(StatementResponse::from).toList(),
                    r.checks().stream().map(CheckResponse::from).toList(),
                    r.reasons());
        }

        private static ReportItemResponse item(Report report, Map<String, FinancialDataStatus> statuses) {
            return ReportItemResponse.from(report, statuses.get(report.getRceptNo()));
        }
    }

    public record StatementResponse(String sjDiv, String label, boolean comparable, AmountBasis amountBasis,
            String note) {

        static StatementResponse from(StatementRule rule) {
            return new StatementResponse(rule.type().name(), rule.type().label(), rule.comparable(),
                    rule.amountBasis(), rule.note());
        }
    }

    public record CheckResponse(String item, String label, String status, String detail) {

        static CheckResponse from(ComparabilityService.Check check) {
            return new CheckResponse(check.item().name(), check.item().label(), check.status().name(),
                    check.detail());
        }
    }
}
