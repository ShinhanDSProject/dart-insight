package com.dartinsight.analysis;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 문장·표 변경 목록(2.5) 조회. 완료된 분석의 그 분석 결과만 돌려준다. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TextChangeQueryService {

    private final AnalysisResultService resultService;
    private final TextChangeStore store;

    /**
     * 완료된 분석의 변경 한 쪽. 완료되지 않았으면 409.
     *
     * @param type       변경 종류. null이면 모두
     * @param byPriority true면 확인 우선순위 순, false면 문서 순
     */
    public TextChangePage page(Long analysisId, String type, boolean byPriority, long offset, int limit) {
        Analysis analysis = resultService.completed(analysisId);
        Map<String, Integer> counts = store.counts(analysisId);
        List<TextChange> changes = store.page(analysisId, type, byPriority, offset, limit);
        return new TextChangePage(analysis, counts, changes);
    }

    /** @param counts 변경 종류 → 개수(분석 전체) */
    public record TextChangePage(Analysis analysis, Map<String, Integer> counts, List<TextChange> changes) {
    }
}
