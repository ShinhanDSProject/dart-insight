package com.dartinsight.analysis.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeListing;
import com.dartinsight.analysis.domain.TextSectionCount;
import com.dartinsight.analysis.repository.TextChangeStore;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
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
        String listVersion = store.listVersion(analysisId);
        // 분류 전에 만든 분석은 묶음·분야를 무시하고 저장된 변경을 그대로 준다(ADR-0047)
        TextChangeFilter applied = listVersion == null ? filter.withoutListing() : filter;
        TextChangeListing.Summary listing = listVersion == null ? null : new TextChangeListing.Summary(listVersion,
                store.fieldCounts(analysisId), analysis.missingTextFields(), store.groupCounts(analysisId));
        Map<String, Integer> counts = store.counts(analysisId, applied);
        Map<String, Integer> riskCounts = store.riskCounts(analysisId, applied);
        List<TextSectionCount> sections = store.sections(analysisId, applied);
        List<TextChange> changes = store.page(analysisId, applied, byPriority, offset, limit);
        return new TextChangePage(analysis, applied, counts, riskCounts, sections, changes,
                store.count(analysisId, applied), listing);
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

    /** 분류 전에 만든 변경이 있는지(listVersion null). 변경이 없는 분석은 false. 주요 사건(3.36)이 쓴다 */
    public boolean hasUnclassifiedChanges(Long analysisId) {
        return store.listVersion(analysisId) == null
                && store.count(analysisId, new TextChangeFilter(List.of(), null, null)) > 0;
    }

    /** 변경 번호 → 변경. 없는 번호는 빠진다. 분석이 완료됐는지는 부르는 쪽이 이미 확인했다고 본다. 주요 사건(3.36)이 쓴다 */
    public Map<Integer, TextChange> changesByNo(Long analysisId, Collection<Integer> changeNos) {
        return store.findByChangeNos(analysisId, changeNos).stream()
                .collect(Collectors.toMap(TextChange::changeNo, Function.identity()));
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
     * @param filter     실제로 쓴 거르기(분류 전에 만든 분석이면 묶음·분야를 뺀 것)
     * @param counts     변경 종류 → 개수(섹션·검색·위험 관련에 맞는 것, 유형·묶음·분야는 보지 않음)
     * @param riskCounts 위험 관련 목차의 변경 종류 → 개수(섹션·검색에 맞는 것, 유형·위험 관련·묶음·분야는 보지 않음, 3.9)
     * @param sections   최상위 섹션별 개수(유형·검색·위험 관련에 맞는 것, 섹션·묶음·분야는 보지 않음)
     * @param totalItems filter에 모두 맞는 전체 건수(쪽 나누기 전)
     * @param listing    분석 전체의 분류 건수. 분류 전에 만든 분석이면 null
     */
    public record TextChangePage(Analysis analysis, TextChangeFilter filter, Map<String, Integer> counts,
            Map<String, Integer> riskCounts, List<TextSectionCount> sections, List<TextChange> changes,
            int totalItems, TextChangeListing.Summary listing) {
    }
}
