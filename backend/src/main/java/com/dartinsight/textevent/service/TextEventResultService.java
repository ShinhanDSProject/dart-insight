package com.dartinsight.textevent.service;

import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.summary.domain.LlmCallRow;
import com.dartinsight.textevent.domain.TextEventRow;
import com.dartinsight.textevent.domain.TextEventRun;
import com.dartinsight.textevent.repository.TextEventRunRepository;
import com.dartinsight.textevent.repository.TextEventStore;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 사건 저장과 완료 표시를 한 트랜잭션으로 묶는다. 저장을 마치기 전에는 완료로 바꾸지 않는다. */
@Service
@RequiredArgsConstructor
public class TextEventResultService {

    private final TextEventRunRepository runRepository;
    private final TextEventStore store;
    private final AnalysisResultService analysisResultService;

    @Transactional
    public void saveAndComplete(Long runId, List<TextEventRow> events, List<Integer> unboundChangeNos,
            int droppedEventCount, String signalTableVersion, List<LlmCallRow> calls, LocalDateTime now) {
        TextEventRun run = runRepository.findById(runId)
                .orElseThrow(() -> new IllegalStateException("사건 실행이 없습니다: " + runId));
        store.saveAll(runId, events, unboundChangeNos);
        analysisResultService.saveCalls(run.getAnalysisId(), calls);
        run.complete(droppedEventCount, signalTableVersion, now);
    }
}
