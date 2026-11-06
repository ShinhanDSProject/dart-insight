package com.dartinsight.textevent.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.analysis.config.AnalysisProperties;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.summary.domain.LlmCallRow;
import com.dartinsight.summary.service.SummaryService;
import com.dartinsight.textevent.domain.NotCreatedReason;
import com.dartinsight.textevent.domain.TextEventRow;
import com.dartinsight.textevent.domain.TextEventRun;
import com.dartinsight.textevent.domain.TextEventRunStatus;
import com.dartinsight.textevent.domain.TextEvents;
import com.dartinsight.textevent.dto.TextEventAiResponse;
import com.dartinsight.textevent.repository.TextEventRunRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
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
 * 주요 사건 실행(3.36, ADR-0050). 요청 만들기 → ai-server → 다시 확인 → 저장(완료) 순서로 진행한다.
 * 어디서 실패해도 분석에는 손대지 않고 실행만 FAILED로 남기며, 그때까지 받은 LLM 호출 기록은 llm_call에 남긴다.
 * 실행기를 분석과 나눠 오래 걸리는 사건 만들기가 분석 대기열을 막지 않게 한다. 서버가 다시 뜨면 끝나지 않은 실행을 실패로 바꾼다.
 */
@Component
public class TextEventRunner implements DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(TextEventRunner.class);

    private final TextEventRunRepository runRepository;
    private final TextEventRequestService requestService;
    private final TextEventResultService resultService;
    private final AiServerClient aiServerClient;
    private final AnalysisResultService analysisResultService;
    private final SummaryService summaryService;
    private final SignalTableService signalTableService;
    private final Clock clock;
    private final TaskExecutor executor;
    /** 이 실행이 시작된 시각. 이보다 먼저 만들어진 실행만 이전 실행에서 끊긴 것으로 본다 */
    private final LocalDateTime bootedAt;

    public TextEventRunner(TextEventRunRepository runRepository, TextEventRequestService requestService,
            TextEventResultService resultService, AiServerClient aiServerClient,
            AnalysisResultService analysisResultService, SummaryService summaryService,
            SignalTableService signalTableService, Clock clock, AnalysisProperties properties) {
        this.runRepository = runRepository;
        this.requestService = requestService;
        this.resultService = resultService;
        this.aiServerClient = aiServerClient;
        this.analysisResultService = analysisResultService;
        this.summaryService = summaryService;
        this.signalTableService = signalTableService;
        this.clock = clock;
        this.bootedAt = now();
        if (properties.async()) {
            ThreadPoolTaskExecutor pool = new ThreadPoolTaskExecutor();
            pool.setThreadNamePrefix("text-event-");
            pool.setCorePoolSize(2);
            pool.setMaxPoolSize(4);
            pool.setQueueCapacity(100);
            pool.initialize();
            this.executor = pool;
        } else {
            this.executor = new SyncTaskExecutor();
        }
    }

    /** 실행을 대기열에 넣는다. 대기열이 가득 차면 기다리지 않고 실패로 남긴다 */
    public void submit(Long runId) {
        try {
            executor.execute(() -> run(runId));
        } catch (TaskRejectedException e) {
            log.warn("주요 사건 실행 {} 대기열이 가득 차 실행하지 못했습니다", runId);
            fail(runId, TextEvents.BUSY);
        }
    }

    /** 서버가 다시 뜨면, 이전 실행에서 끝나지 않은 실행을 실패로 바꿔 다시 시작할 수 있게 한다(서버 한 대 기준) */
    @EventListener(ApplicationReadyEvent.class)
    public void failInterrupted() {
        List<TextEventRun> unfinished = runRepository.findByStatusInAndCreatedAtBefore(
                List.of(TextEventRunStatus.PENDING, TextEventRunStatus.RUNNING), bootedAt);
        unfinished.forEach(run -> fail(run.getId(), TextEvents.INTERRUPTED));
        if (!unfinished.isEmpty()) {
            log.info("끝나지 않은 주요 사건 실행 {}건을 실패로 바꿨습니다", unfinished.size());
        }
    }

    @Override
    public void destroy() {
        if (executor instanceof ThreadPoolTaskExecutor pool) {
            pool.shutdown();
        }
    }

    private void run(Long runId) {
        String previousTrace = MDC.get(TraceContext.MDC_KEY);
        try {
            TextEventRun run = runRepository.findById(runId).orElse(null);
            if (run == null) {
                return;
            }
            if (run.getTraceId() != null) {
                MDC.put(TraceContext.MDC_KEY, run.getTraceId());
            }
            run.start(now());
            run = runRepository.save(run);
            TextEventRequestService.Input input = requestService.build(run.getAnalysisId());
            TextEventAiResponse response;
            try {
                response = aiServerClient.postTextEvents(input.request(), TextEventAiResponse.class);
            } catch (AiServerException e) {
                saveCalls(run.getAnalysisId(), summaryService.failedCalls(e));
                fail(runId, failureCode(e));
                return;
            }
            finish(run, input, response);
        } catch (RuntimeException e) {
            log.error("주요 사건 실행 {} 실패", runId, e);
            fail(runId, TextEvents.SAVE_FAILED);
        } finally {
            if (previousTrace == null) {
                MDC.remove(TraceContext.MDC_KEY);
            } else {
                MDC.put(TraceContext.MDC_KEY, previousTrace);
            }
        }
    }

    private void finish(TextEventRun run, TextEventRequestService.Input input, TextEventAiResponse response) {
        List<LlmCallRow> calls = TextEventResults.calls(response, run.getTraceId());
        if (!response.created()) {
            notCreate(run, response, calls);
            return;
        }
        String problem = TextEventResults.problem(response, input);
        if (problem != null) {
            log.warn("주요 사건 실행 {} 결과를 쓰지 않습니다: {}", run.getId(), problem);
            saveCalls(run.getAnalysisId(), calls);
            fail(run.getId(), TextEvents.AI_INVALID_OUTPUT);
            return;
        }
        try {
            // 기준표는 문장 근거가 어긋나 신호 이유를 일반 문구로 바꿀 때만 받는다(저장 트랜잭션 밖)
            List<TextEventRow> rows = TextEventResults.rows(response, input.sent(),
                    () -> signalTableService.table(response.signalTableVersion()));
            resultService.saveAndComplete(run.getId(), rows, TextEventResults.unbound(response),
                    response.droppedEventCount(), response.signalTableVersion(), calls, now());
            log.info("주요 사건 실행 {} 완료: 사건 {}건, 뺀 사건 {}건", run.getId(), response.events().size(),
                    response.droppedEventCount());
        } catch (RuntimeException e) {
            log.warn("주요 사건 실행 {} 결과 저장 실패", run.getId(), e);
            saveCalls(run.getAnalysisId(), calls);
            fail(run.getId(), TextEvents.SAVE_FAILED);
        }
    }

    private void notCreate(TextEventRun run, TextEventAiResponse response, List<LlmCallRow> calls) {
        saveCalls(run.getAnalysisId(), calls);
        Optional<NotCreatedReason> reason = TextEventResults.notCreatedReason(response);
        if (reason.isEmpty()) {
            log.warn("주요 사건 실행 {} 만들지 않은 사유를 알 수 없습니다", run.getId());
            fail(run.getId(), TextEvents.AI_INVALID_OUTPUT);
            return;
        }
        run.notCreate(reason.get(), now());
        runRepository.save(run);
    }

    /** ai-server가 알려 준 사유. 그 밖의 실패는 AI 서버를 쓸 수 없는 것으로 본다 */
    private static String failureCode(AiServerException e) {
        String remote = e.remoteCode();
        return TextEvents.AI_LLM_UNAVAILABLE.equals(remote) || TextEvents.AI_INVALID_OUTPUT.equals(remote)
                ? remote : TextEvents.AI_SERVER_UNAVAILABLE;
    }

    /** 실패로 끝나는 실행의 호출 기록을 남긴다. 저장하지 못해도 실행은 실패로 끝내므로 로그만 남긴다 */
    private void saveCalls(Long analysisId, List<LlmCallRow> calls) {
        try {
            analysisResultService.saveCalls(analysisId, calls);
        } catch (RuntimeException e) {
            log.warn("분석 {} 주요 사건의 LLM 호출 기록 {}건을 저장하지 못했습니다", analysisId, calls.size(), e);
        }
    }

    /** 실패로 남긴다. 이미 끝난 실행이면 그대로 둔다. 다시 읽어서 바꾸므로 다른 곳의 변경을 덮어쓰지 않는다 */
    private void fail(Long runId, String code) {
        try {
            TextEventRun run = runRepository.findById(runId).orElse(null);
            if (run == null || run.finished()) {
                return;
            }
            run.fail(code, now());
            runRepository.save(run);
            log.info("주요 사건 실행 {} 실패({})", runId, code);
        } catch (RuntimeException e) {
            log.error("주요 사건 실행 {} 실패 상태를 저장하지 못했습니다. 서버 재시작 때 정리됩니다", runId, e);
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
