package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextSectionCount;
import com.dartinsight.analysis.repository.TextChangeStore;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
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
        Map<String, Integer> riskCounts = store.riskCounts(analysisId, filter);
        List<TextSectionCount> sections = store.sections(analysisId, filter);
        List<TextChange> changes = store.page(analysisId, filter, byPriority, offset, limit);
        return new TextChangePage(analysis, counts, riskCounts, sections, changes);
    }

    /** 완료된 분석의 문장 변경 하나. 없는 분석·변경은 404, 완료되지 않았으면 409 */
    public CompletedTextChange completedChange(Long analysisId, Long changeId) {
        Analysis analysis = resultService.completed(analysisId);
        TextChange change = store.find(analysisId, changeId)
                .orElseThrow(() -> new ApiException(ErrorCode.ANALYSIS_TEXT_CHANGE_NOT_FOUND));
        return new CompletedTextChange(analysis, change);
    }

    /** 완료된 분석과 그 변경 전부(문서 순서). 없는 분석은 404, 완료되지 않았으면 409. 관련 수시공시(3.6)가 쓴다 */
    public CompletedTextChanges completedChanges(Long analysisId) {
        Analysis analysis = resultService.completed(analysisId);
        return new CompletedTextChanges(analysis, store.all(analysisId));
    }

    /**
     * 변경이 있는 섹션 경로 전부(문서 순서). 질문(3.10)의 섹션 찾기에 쓴다.
     * 분석이 완료됐는지는 부르는 쪽이 이미 확인했다고 본다.
     */
    public List<String> sectionPaths(Long analysisId) {
        return store.sectionPaths(analysisId);
    }

    /**
     * 섹션(그 섹션과 하위 섹션)의 변경을 확인 우선순위 순으로 최대 limit개. 질문(3.10)의 후보 고르기에 쓴다.
     * 분석이 완료됐는지는 부르는 쪽이 이미 확인했다고 본다.
     *
     * @param section 섹션 경로(최상위 제목이나 "상위 > 하위" 앞부분)
     */
    public List<TextChange> changesInSection(Long analysisId, String section, int limit) {
        return store.page(analysisId, new TextChangeFilter(List.of(), section, null), true, 0, limit);
    }

    public record CompletedTextChange(Analysis analysis, TextChange change) {
    }

    public record CompletedTextChanges(Analysis analysis, List<TextChange> changes) {
    }

    /**
     * @param counts     변경 종류 → 개수(섹션·검색·위험 관련에 맞는 것, 유형 조건은 보지 않음)
     * @param riskCounts 위험 관련 목차의 변경 종류 → 개수(섹션·검색에 맞는 것, 유형·위험 관련 조건은 보지 않음, 3.9)
     * @param sections   최상위 섹션별 개수(유형·검색·위험 관련에 맞는 것, 섹션 조건은 보지 않음)
     */
    public record TextChangePage(Analysis analysis, Map<String, Integer> counts, Map<String, Integer> riskCounts,
            List<TextSectionCount> sections, List<TextChange> changes) {
    }
}
