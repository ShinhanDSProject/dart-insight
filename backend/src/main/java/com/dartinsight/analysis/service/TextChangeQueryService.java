package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextSectionCount;
import com.dartinsight.analysis.repository.TextChangeStore;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 문장·표 변경 목록(2.5) 조회와 섹션 거르기·검색(3.7). 완료된 분석의 그 분석 결과만 돌려준다. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TextChangeQueryService {

    private final AnalysisResultService resultService;
    private final TextChangeStore store;

    /**
     * 완료된 분석에서 filter에 맞는 변경 한 쪽. 완료되지 않았으면 409.
     *
     * @param byPriority true면 확인 우선순위 순, false면 문서 순
     */
    public TextChangePage page(Long analysisId, TextChangeFilter filter, boolean byPriority, long offset,
            int limit) {
        Analysis analysis = resultService.completed(analysisId);
        Map<String, Integer> counts = store.counts(analysisId, filter);
        List<TextSectionCount> sections = store.sections(analysisId, filter);
        List<TextChange> changes = store.page(analysisId, filter, byPriority, offset, limit);
        return new TextChangePage(analysis, counts, sections, changes);
    }

    /**
     * @param counts   변경 종류 → 개수(섹션·검색에 맞는 것, 유형 조건은 보지 않음)
     * @param sections 최상위 섹션별 개수(유형·검색에 맞는 것, 섹션 조건은 보지 않음)
     */
    public record TextChangePage(Analysis analysis, Map<String, Integer> counts, List<TextSectionCount> sections,
            List<TextChange> changes) {
    }
}
