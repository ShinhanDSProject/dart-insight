package com.dartinsight.textevent.service;

import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.textevent.domain.TextEvent;
import com.dartinsight.textevent.domain.TextEventRunStatus;
import com.dartinsight.textevent.domain.TextEventRunView;
import com.dartinsight.textevent.domain.TextEventSignal;
import com.dartinsight.textevent.repository.TextEventStore;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 주요 사건 목록과 하나(3.36). 현재 사건 버전의 COMPLETED 실행만 돌려주고, 그 밖의 상태는 409로 나눈다. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TextEventQueryService {

    private final TextEventRunService runService;
    private final TextEventStore store;
    private final TextChangeQueryService textChangeQueryService;
    private final AnalysisResultService analysisResultService;

    /** @param signal 이 신호의 사건만(#738). null이면 전부. 정해진 값이 아니면 400 */
    public EventList events(Long analysisId, String signal) {
        if (signal != null && !TextEventSignal.SIGNALS.contains(signal)) {
            throw ApiException.invalidInput("signal", "CAUTION, POSITIVE, HOLD 중 하나여야 합니다.");
        }
        TextEventRunView run = completedRun(analysisId);
        List<TextEvent> events = store.events(run.runId());
        List<Integer> unbound = store.unboundChangeNos(run.runId());
        List<Integer> changeNos = new ArrayList<>(unbound);
        events.forEach(event -> changeNos.addAll(event.row().changeNos()));
        return new EventList(analysisId, run.droppedEventCount(), run.signalTableVersion(), events, signal, unbound,
                textChangeQueryService.changesByNo(analysisId, changeNos), financialChanges(analysisId));
    }

    /** 이 분석의 현재 버전 사건이 아니면 404 */
    public EventDetail event(Long analysisId, Long eventId) {
        TextEventRunView run = completedRun(analysisId);
        TextEvent event = store.event(run.runId(), eventId)
                .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_EVENT_NOT_FOUND));
        return new EventDetail(event, textChangeQueryService.changesByNo(analysisId, event.row().changeNos()),
                financialChanges(analysisId));
    }

    /** 사실 칸의 값은 같은 분석의 재무 수치를 그대로 쓴다(ADR-0060) */
    private List<FinancialChange> financialChanges(Long analysisId) {
        return analysisResultService.completedResult(analysisId).changes();
    }

    private TextEventRunView completedRun(Long analysisId) {
        TextEventRunView run = runService.current(analysisId);
        if (run.is(TextEventRunStatus.COMPLETED)) {
            return run;
        }
        if (run.is(TextEventRunStatus.FAILED)) {
            throw new ApiException(ErrorCode.ANALYSIS_EVENTS_FAILED);
        }
        if (run.is(TextEventRunStatus.NOT_CREATED)) {
            throw new ApiException(ErrorCode.ANALYSIS_EVENTS_NOT_CREATED);
        }
        throw new ApiException(ErrorCode.ANALYSIS_EVENTS_NOT_READY);
    }

    /**
     * @param events           실행의 사건 전부. 개수 칸은 거르기와 상관없이 이 목록으로 센다
     * @param signal           거를 신호. null이면 거르지 않는다
     * @param changes          변경 번호 → 사건에 묶였거나 묶이지 않은 변경
     * @param financialChanges 같은 분석의 재무 수치(사실 칸)
     */
    public record EventList(long analysisId, int droppedEventCount, String signalTableVersion, List<TextEvent> events,
            String signal, List<Integer> unboundChangeNos, Map<Integer, TextChange> changes,
            List<FinancialChange> financialChanges) {
    }

    /** @param changes 변경 번호 → 사건에 묶인 변경 */
    public record EventDetail(TextEvent event, Map<Integer, TextChange> changes,
            List<FinancialChange> financialChanges) {
    }
}
