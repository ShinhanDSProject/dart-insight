package com.dartinsight.textevent.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.textevent.config.TextEventProperties;
import com.dartinsight.textevent.domain.NotCreatedReason;
import com.dartinsight.textevent.domain.TextEventRun;
import com.dartinsight.textevent.domain.TextEventRunStatus;
import com.dartinsight.textevent.domain.TextEventRunView;
import com.dartinsight.textevent.domain.TextEvents;
import com.dartinsight.textevent.repository.TextEventRunRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * 주요 사건 실행 시작과 상태(3.36, ADR-0050). 시작은 멱등하다. 진행 중이거나 끝난 실행은 그대로 돌려주고,
 * 실패했거나 fake 모델이었을 때만 새 실행을 만든다. 동시 시작은 유니크 키(uk_text_event_run)가 막는다.
 */
@Service
@RequiredArgsConstructor
public class TextEventRunService {

    private final AnalysisResultService resultService;
    private final TextChangeQueryService textChangeQueryService;
    private final TextEventRunRepository runRepository;
    private final TextEventRunner runner;
    private final TextEventProperties properties;
    private final Clock clock;

    /** 시작하거나 지금 실행을 돌려준다. 없는 분석 404, 끝나지 않은 분석 409, 최근 24시간에 3번 실패했으면 429 */
    public StartResult start(Long analysisId) {
        Analysis analysis = resultService.completed(analysisId);
        Optional<NotCreatedReason> reason = reasonNotToCreate(analysis);
        if (reason.isPresent()) {
            return new StartResult(false, TextEventRunView.notCreated(analysisId, reason.get()));
        }
        TextEventRun latest = latest(analysisId).orElse(null);
        if (latest != null && !latest.startsAgain()) {
            return new StartResult(!latest.finished(), view(latest));
        }
        if (latest != null && latest.getStatus() == TextEventRunStatus.FAILED && !canRetry(analysisId)) {
            throw new ApiException(ErrorCode.ANALYSIS_EVENTS_RETRY_LIMITED);
        }
        TextEventRun created;
        try {
            created = runRepository.saveAndFlush(TextEventRun.create(analysisId, TextEvents.EVENT_VERSION,
                    latest == null ? 1 : latest.getAttemptNo() + 1, TraceContext.currentTraceId(), now()));
        } catch (DataIntegrityViolationException e) {
            // 다른 요청이 먼저 만들었다. 그 실행을 돌려준다
            TextEventRun other = latest(analysisId).orElseThrow(() -> e);
            return new StartResult(!other.finished(), view(other));
        }
        runner.submit(created.getId());
        return new StartResult(true, current(analysisId));
    }

    /** 현재 사건 버전의 작업 상태. 없는 분석 404, 끝나지 않은 분석 409 */
    public TextEventRunView current(Long analysisId) {
        Analysis analysis = resultService.completed(analysisId);
        return reasonNotToCreate(analysis)
                .map(reason -> TextEventRunView.notCreated(analysisId, reason))
                .or(() -> latest(analysisId).map(this::view))
                .orElseGet(() -> TextEventRunView.notStarted(analysisId));
    }

    /** 저장하지 않고 조회할 때 정하는 '만들지 않음' 사유 */
    private Optional<NotCreatedReason> reasonNotToCreate(Analysis analysis) {
        if (!properties.enabled()) {
            return Optional.of(NotCreatedReason.DISABLED);
        }
        if (!analysis.hasTextResult()) {
            return Optional.of(NotCreatedReason.TEXT_COMPARE_FAILED);
        }
        if (textChangeQueryService.hasUnclassifiedChanges(analysis.getId())) {
            return Optional.of(NotCreatedReason.OLD_ANALYSIS);
        }
        return Optional.empty();
    }

    private Optional<TextEventRun> latest(Long analysisId) {
        return runRepository.findFirstByAnalysisIdAndEventVersionOrderByAttemptNoDesc(analysisId,
                TextEvents.EVENT_VERSION);
    }

    private TextEventRunView view(TextEventRun run) {
        return TextEventRunView.of(run,
                run.getStatus() == TextEventRunStatus.FAILED && canRetry(run.getAnalysisId()));
    }

    private boolean canRetry(Long analysisId) {
        return runRepository.countByAnalysisIdAndEventVersionAndStatusAndErrorCodeNotAndFinishedAtAfter(analysisId,
                TextEvents.EVENT_VERSION, TextEventRunStatus.FAILED, TextEvents.BUSY,
                now().minus(TextEvents.FAILURE_WINDOW)) < TextEvents.MAX_FAILURES;
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }

    /** @param accepted 새로 시작했거나 진행 중이면 true(202) */
    public record StartResult(boolean accepted, TextEventRunView run) {
    }
}
