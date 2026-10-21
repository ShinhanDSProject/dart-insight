package com.dartinsight.analysis;

import com.dartinsight.analysis.FinancialComparator.Side;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.comparison.ComparabilityService;
import com.dartinsight.comparison.ComparabilityService.ComparabilityResult;
import com.dartinsight.financial.FinancialStatementService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.stereotype.Component;

/**
 * 분석 실행(2.3). 요청 접수 → 보고서 비교 → 근거 확인 → 결과 저장(완료) 순서로 진행한다.
 * 결과 저장과 완료 표시는 한 트랜잭션이다(4.3). 어느 단계에서든 실패하면 그 단계에 FAILED로 남긴다.
 */
@Component
public class AnalysisRunner {

    private static final Logger log = LoggerFactory.getLogger(AnalysisRunner.class);

    private final AnalysisRepository analysisRepository;
    private final AnalysisResultService resultService;
    private final ComparabilityService comparabilityService;
    private final FinancialStatementService financialStatementService;
    private final Clock clock;
    private final Executor executor;

    public AnalysisRunner(AnalysisRepository analysisRepository, AnalysisResultService resultService,
            ComparabilityService comparabilityService, FinancialStatementService financialStatementService,
            Clock clock, AnalysisProperties properties) {
        this.analysisRepository = analysisRepository;
        this.resultService = resultService;
        this.comparabilityService = comparabilityService;
        this.financialStatementService = financialStatementService;
        this.clock = clock;
        if (properties.async()) {
            SimpleAsyncTaskExecutor async = new SimpleAsyncTaskExecutor("analysis-");
            async.setConcurrencyLimit(4);
            this.executor = async;
        } else {
            this.executor = new SyncTaskExecutor();
        }
    }

    public void submit(Long analysisId) {
        executor.execute(() -> run(analysisId));
    }

    void run(Long analysisId) {
        Analysis analysis = analysisRepository.findById(analysisId).orElse(null);
        if (analysis == null) {
            return;
        }
        String previousTrace = MDC.get(TraceContext.MDC_KEY);
        if (analysis.getRequestTraceId() != null) {
            MDC.put(TraceContext.MDC_KEY, analysis.getRequestTraceId());
        }
        try {
            analysis.start(now());
            analysis = analysisRepository.save(analysis);

            analysis.advance(AnalysisStep.COMPARING, now());
            analysis = analysisRepository.save(analysis);
            ComparabilityResult check = comparabilityService.check(analysis.getCorpCode(),
                    analysis.getCurrentRceptNo(), analysis.getPreviousRceptNo(), analysis.getBasis());
            if (!check.comparable()) {
                fail(analysis, "ANALYSIS_NOT_COMPARABLE", check.reasons().isEmpty() ? "비교할 수 없는 보고서 쌍이에요."
                        : check.reasons().getFirst().message());
                return;
            }
            analysis.recordFsDiv(check.fsDiv());
            List<FinancialChangeRow> rows = FinancialComparator.compare(check.fsDiv(), check.statements(),
                    new Side(check.previous().getReportType(),
                            financialStatementService.accounts(check.previousFetch())),
                    new Side(check.current().getReportType(),
                            financialStatementService.accounts(check.currentFetch())));

            analysis.advance(AnalysisStep.VERIFYING, now());
            analysis = analysisRepository.save(analysis);
            String problem = verify(analysis, rows);
            if (problem != null) {
                fail(analysis, "ANALYSIS_EVIDENCE_MISMATCH", problem);
                return;
            }

            try {
                resultService.saveAndComplete(analysis.getId(), rows);
            } catch (RuntimeException e) {
                log.warn("분석 {} 결과 저장 실패", analysisId, e);
                fail(analysisRepository.findById(analysisId).orElse(analysis), "ANALYSIS_SAVE_FAILED",
                        "결과를 저장하지 못했어요. 다시 요청해 주세요.");
                return;
            }
            log.info("분석 {} 완료: 계정 {}건", analysisId, rows.size());
        } catch (ApiException e) {
            fail(analysis, e.errorCode().name(), e.getMessage());
        } catch (RuntimeException e) {
            log.error("분석 {} 실패", analysisId, e);
            fail(analysis, "ANALYSIS_FAILED", "분석 중 알 수 없는 오류가 났어요. 다시 요청해 주세요.");
        } finally {
            if (previousTrace == null) {
                MDC.remove(TraceContext.MDC_KEY);
            } else {
                MDC.put(TraceContext.MDC_KEY, previousTrace);
            }
        }
    }

    /**
     * 근거 확인: 값이 있는 계정은 그 보고서의 접수번호를 근거로 갖고, 증감액이 두 값의 차와 같아야 한다.
     *
     * @return 문제가 있으면 설명, 없으면 null
     */
    static String verify(Analysis analysis, List<FinancialChangeRow> rows) {
        for (FinancialChangeRow row : rows) {
            if (row.previousAmount() != null && (row.previous() == null
                    || !analysis.getPreviousRceptNo().equals(row.previous().rceptNo()))) {
                return "이전 값의 근거가 비교 보고서가 아니에요: " + row.accountName();
            }
            if (row.currentAmount() != null && (row.current() == null
                    || !analysis.getCurrentRceptNo().equals(row.current().rceptNo()))) {
                return "현재 값의 근거가 현재 보고서가 아니에요: " + row.accountName();
            }
            if (row.changeAmount() != null && (row.previousAmount() == null || row.currentAmount() == null
                    || !Objects.equals(row.changeAmount(), row.currentAmount() - row.previousAmount()))) {
                return "증감액이 두 값의 차와 달라요: " + row.accountName();
            }
        }
        return null;
    }

    private void fail(Analysis analysis, String code, String message) {
        try {
            Analysis current = analysisRepository.findById(analysis.getId()).orElse(analysis);
            if (current.getStatus().finished()) {
                return;
            }
            current.fail(code, message, now());
            analysisRepository.save(current);
            log.info("분석 {} 실패({}): {}", analysis.getId(), code, message);
        } catch (RuntimeException e) {
            log.error("분석 {} 실패 상태를 저장하지 못했습니다", analysis.getId(), e);
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
