package com.dartinsight.analysis;

import com.dartinsight.analysis.FinancialComparator.Side;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.comparison.ComparabilityService;
import com.dartinsight.comparison.ComparabilityService.ComparabilityResult;
import com.dartinsight.financial.FinancialStatementService;
import com.dartinsight.financial.FinancialAccount;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

/**
 * 분석 실행(2.3). 요청 접수 → 보고서 비교(재무 수치·문장) → 근거 확인 → 결과 저장(완료) 순서로 진행한다.
 * 결과 저장과 완료 표시는 한 트랜잭션이다(4.3). 어느 단계에서든 실패하면 그 단계에 FAILED로 남긴다.
 * 문장 비교(2.5)는 원문을 받지 못해도 분석을 실패로 만들지 않고, 문장 비교 상태에 사유를 남긴다.
 * 실행은 대기열이 있는 스레드 풀에서 하므로 요청 스레드를 막지 않는다. 서버가 다시 뜨면 끝나지 않은 분석을 실패로 바꾼다.
 */
@Component
public class AnalysisRunner implements DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(AnalysisRunner.class);

    private final AnalysisRepository analysisRepository;
    private final AnalysisResultService resultService;
    private final ComparabilityService comparabilityService;
    private final FinancialStatementService financialStatementService;
    private final TextComparisonService textComparisonService;
    private final Clock clock;
    private final TaskExecutor executor;
    /** 이 실행이 시작된 시각. 이보다 먼저 만들어진 분석만 이전 실행에서 끊긴 것으로 본다 */
    private final LocalDateTime bootedAt;

    public AnalysisRunner(AnalysisRepository analysisRepository, AnalysisResultService resultService,
            ComparabilityService comparabilityService, FinancialStatementService financialStatementService,
            TextComparisonService textComparisonService, Clock clock, AnalysisProperties properties) {
        this.analysisRepository = analysisRepository;
        this.resultService = resultService;
        this.comparabilityService = comparabilityService;
        this.financialStatementService = financialStatementService;
        this.textComparisonService = textComparisonService;
        this.clock = clock;
        this.bootedAt = now();
        if (properties.async()) {
            ThreadPoolTaskExecutor pool = new ThreadPoolTaskExecutor();
            pool.setThreadNamePrefix("analysis-");
            pool.setCorePoolSize(2);
            pool.setMaxPoolSize(4);
            pool.setQueueCapacity(100);
            pool.initialize();
            this.executor = pool;
        } else {
            this.executor = new SyncTaskExecutor();
        }
    }

    /** 분석을 대기열에 넣는다. 대기열이 가득 차면 기다리지 않고 그 분석을 실패로 남긴다. */
    public void submit(Long analysisId) {
        try {
            executor.execute(() -> run(analysisId));
        } catch (TaskRejectedException e) {
            log.warn("분석 {} 대기열이 가득 차 실행하지 못했습니다", analysisId);
            fail(analysisId, "ANALYSIS_BUSY", "분석 요청이 많아 지금은 실행하지 못했어요. 잠시 뒤 다시 요청해 주세요.");
        }
    }

    /**
     * 서버가 다시 뜨면, 이전 실행에서 끝나지 않은 분석을 실패로 바꿔 다시 요청할 수 있게 한다(서버 한 대 기준).
     * 웹 서버는 이 이벤트보다 먼저 요청을 받기 시작하므로, 이번 실행에서 만든 분석은 건드리지 않는다.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void failInterrupted() {
        List<Analysis> unfinished = analysisRepository.findByStatusInAndCreatedAtBefore(
                List.of(AnalysisStatus.PENDING, AnalysisStatus.RUNNING), bootedAt);
        for (Analysis analysis : unfinished) {
            fail(analysis.getId(), "ANALYSIS_INTERRUPTED", "서버가 다시 시작돼 분석이 중단됐어요. 다시 요청해 주세요.");
        }
        if (!unfinished.isEmpty()) {
            log.info("끝나지 않은 분석 {}건을 실패로 바꿨습니다", unfinished.size());
        }
    }

    @Override
    public void destroy() {
        if (executor instanceof ThreadPoolTaskExecutor pool) {
            pool.shutdown();
        }
    }

    void run(Long analysisId) {
        String previousTrace = MDC.get(TraceContext.MDC_KEY);
        try {
            Analysis analysis = analysisRepository.findById(analysisId).orElse(null);
            if (analysis == null) {
                return;
            }
            if (analysis.getRequestTraceId() != null) {
                MDC.put(TraceContext.MDC_KEY, analysis.getRequestTraceId());
            }
            analysis.start(now());
            analysis = analysisRepository.save(analysis);

            analysis.advance(AnalysisStep.COMPARING, now());
            analysis = analysisRepository.save(analysis);
            ComparabilityResult check = comparabilityService.check(analysis.getCorpCode(),
                    analysis.getCurrentRceptNo(), analysis.getPreviousRceptNo(), analysis.getBasis());
            if (!check.comparable()) {
                fail(analysisId, "ANALYSIS_NOT_COMPARABLE", check.reasons().isEmpty() ? "비교할 수 없는 보고서 쌍이에요."
                        : check.reasons().getFirst().message());
                return;
            }
            analysis.recordFsDiv(check.fsDiv());
            List<FinancialChangeRow> rows = FinancialComparator.compare(check.fsDiv(), check.statements(),
                    new Side(check.previous().getReportType(),
                            financialStatementService.accounts(check.previousFetch())),
                    new Side(check.current().getReportType(),
                            financialStatementService.accounts(check.currentFetch())));
            TextComparison text = textComparisonService.compare(check.previous(), check.current());

            analysis.advance(AnalysisStep.VERIFYING, now());
            analysis = analysisRepository.save(analysis);
            String problem = verify(analysis, rows);
            if (problem != null) {
                fail(analysisId, "ANALYSIS_EVIDENCE_MISMATCH", problem);
                return;
            }
            String textProblem = verifyText(analysis, text.rows());
            if (textProblem != null) {
                // 문장 비교 결과만 쓰지 않는다. 재무 결과는 그대로 저장한다
                log.warn("분석 {} 문장 비교 근거 확인 실패: {}", analysisId, textProblem);
                text = TextComparison.failed("문장 비교 결과의 원문 위치를 확인하지 못해 쓰지 않았어요. (" + textProblem + ")");
            }

            try {
                resultService.saveAndComplete(analysis.getId(), rows, text);
            } catch (RuntimeException e) {
                log.warn("분석 {} 결과 저장 실패", analysisId, e);
                fail(analysisId, "ANALYSIS_SAVE_FAILED", "결과를 저장하지 못했어요. 다시 요청해 주세요.");
                return;
            }
            log.info("분석 {} 완료: 계정 {}건, 문장 변경 {}건({})", analysisId, rows.size(), text.rows().size(),
                    text.status());
        } catch (ApiException e) {
            fail(analysisId, e.errorCode().name(), e.getMessage());
        } catch (RuntimeException e) {
            log.error("분석 {} 실패", analysisId, e);
            fail(analysisId, "ANALYSIS_FAILED", "분석 중 알 수 없는 오류가 났어요. 다시 요청해 주세요.");
        } finally {
            if (previousTrace == null) {
                MDC.remove(TraceContext.MDC_KEY);
            } else {
                MDC.put(TraceContext.MDC_KEY, previousTrace);
            }
        }
    }

    /**
     * 근거 확인: 값이 있는 계정은 그 보고서의 접수번호를 근거로 갖고, 두 보고서에서 짝지은 계정은 같은 계정이며
     * (표준계정코드가 같고, 표준계정이 아니면 정규화한 계정명이 같음), 증감액이 두 값의 차와 같아야 한다.
     *
     * @return 문제가 있으면 설명, 없으면 null
     */
    static String verify(Analysis analysis, List<FinancialChangeRow> rows) {
        for (FinancialChangeRow row : rows) {
            if (row.previous() != null && row.current() != null && !sameAccount(row.previous(), row.current())) {
                return "다른 계정끼리 짝지었어요: " + row.accountName();
            }
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

    /**
     * 문장 비교 근거 확인: 변경 유형에 맞는 쪽에 위치가 있고, 위치는 이 분석의 두 보고서이며,
     * 문단·표 변경은 저장된 원문 글을 가리켜야 한다. 짝을 정하지 못한 섹션은 검토 필요 사유가 있어야 한다.
     *
     * @return 문제가 있으면 설명, 없으면 null
     */
    static String verifyText(Analysis analysis, List<TextChangeRow> rows) {
        for (TextChangeRow row : rows) {
            boolean hasPrevious = row.previous() != null;
            boolean hasCurrent = row.current() != null;
            boolean shapeOk = switch (row.changeType() == null ? "" : row.changeType()) {
                case TextChangeRow.ADDED -> !hasPrevious && hasCurrent;
                case TextChangeRow.DELETED -> hasPrevious && !hasCurrent;
                case TextChangeRow.MODIFIED -> hasPrevious && hasCurrent;
                case TextChangeRow.REVIEW_NEEDED -> (hasPrevious || hasCurrent) && row.reviewReason() != null;
                default -> false;
            };
            if (!shapeOk) {
                return "변경 유형과 위치가 맞지 않아요: " + row.changeType() + " " + row.sectionPath();
            }
            if (hasPrevious && !analysis.getPreviousRceptNo().equals(row.previous().rceptNo())
                    || hasCurrent && !analysis.getCurrentRceptNo().equals(row.current().rceptNo())) {
                return "변경 위치가 이 분석의 보고서가 아니에요: " + row.sectionPath();
            }
            if (!TextChangeRow.SECTION.equals(row.blockType())
                    && (hasPrevious && (row.previous().blockNo() == null || row.previous().text() == null)
                    || hasCurrent && (row.current().blockNo() == null || row.current().text() == null))) {
                return "변경 위치의 원문을 찾지 못했어요: " + row.sectionPath();
            }
        }
        return null;
    }

    private static boolean sameAccount(FinancialChangeRow.Evidence previous, FinancialChangeRow.Evidence current) {
        if (!Objects.equals(previous.accountId(), current.accountId())) {
            return false;
        }
        boolean standard = previous.accountId() != null && !previous.accountId().isBlank()
                && !FinancialAccount.NON_STANDARD_ACCOUNT_ID.equals(previous.accountId());
        return standard || Objects.equals(FinancialComparator.normalize(previous.accountName()),
                FinancialComparator.normalize(current.accountName()));
    }

    /** 실패로 남긴다. 이미 끝난 분석이면 그대로 둔다. 다시 읽어서 바꾸므로 다른 곳의 변경을 덮어쓰지 않는다. */
    private void fail(Long analysisId, String code, String message) {
        try {
            Analysis current = analysisRepository.findById(analysisId).orElse(null);
            if (current == null || current.getStatus().finished()) {
                return;
            }
            current.fail(code, message, now());
            analysisRepository.save(current);
            log.info("분석 {} 실패({}): {}", analysisId, code, message);
        } catch (RuntimeException e) {
            log.error("분석 {} 실패 상태를 저장하지 못했습니다. 다음 요청이나 서버 재시작 때 정리됩니다", analysisId, e);
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
