package com.dartinsight.textevent.service;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.textevent.domain.TextEvent;
import com.dartinsight.textevent.domain.TextEventRunStatus;
import com.dartinsight.textevent.domain.TextEventRunView;
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

    public EventList events(Long analysisId) {
        TextEventRunView run = completedRun(analysisId);
        List<TextEvent> events = store.events(run.runId());
        List<Integer> unbound = store.unboundChangeNos(run.runId());
        List<Integer> changeNos = new ArrayList<>(unbound);
        events.forEach(event -> changeNos.addAll(event.row().changeNos()));
        return new EventList(analysisId, run.droppedEventCount(), events, unbound,
                textChangeQueryService.changesByNo(analysisId, changeNos));
    }

    /** 이 분석의 현재 버전 사건이 아니면 404 */
    public EventDetail event(Long analysisId, Long eventId) {
        TextEventRunView run = completedRun(analysisId);
        TextEvent event = store.event(run.runId(), eventId)
                .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_EVENT_NOT_FOUND));
        return new EventDetail(event, textChangeQueryService.changesByNo(analysisId, event.row().changeNos()));
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

    /** @param changes 변경 번호 → 사건에 묶였거나 묶이지 않은 변경 */
    public record EventList(long analysisId, int droppedEventCount, List<TextEvent> events,
            List<Integer> unboundChangeNos, Map<Integer, TextChange> changes) {
    }

    /** @param changes 변경 번호 → 사건에 묶인 변경 */
    public record EventDetail(TextEvent event, Map<Integer, TextChange> changes) {
    }
}
