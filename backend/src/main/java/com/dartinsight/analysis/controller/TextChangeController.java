package com.dartinsight.analysis.controller;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.dto.TextChangeDetailResponse;
import com.dartinsight.analysis.dto.TextChangeItemResponse;
import com.dartinsight.analysis.dto.TextChangeListResponse.Counts;
import com.dartinsight.analysis.dto.TextChangeListResponse.SectionView;
import com.dartinsight.analysis.dto.TextChangeListResponse;
import com.dartinsight.analysis.service.TextChangeQueryService.TextChangePage;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.ApiPaths;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 문장·표 변경 목록(2.5). 화면 W-03 ③. 완료된 분석의 그 분석 결과만 돌려준다.
 * 기본 정렬은 확인 우선순위(2.6)이고, 순위를 매기지 않은 항목(판단 유보)은 뒤에 둔다.
 * 유형(type)·최상위 섹션(section)·검색어(q)로 함께 거를 수 있다(3.7).
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_TEXT_CHANGES)
@RequiredArgsConstructor
public class TextChangeController {

    private static final Set<String> TYPES = Set.copyOf(TextChangeRow.TYPES);
    private static final int MAX_SIZE = 100;
    private static final int MAX_SECTION = 500;
    private static final int MIN_QUERY = 2;
    private static final int MAX_QUERY = 100;

    private final TextChangeQueryService queryService;
    private final TextEvidenceService evidenceService;

    /** 문장·표 근거 상세(3.4). 변경 전·후 원문 전체와 보고서·항목·위치 */
    @GetMapping(ApiPaths.BY_CHANGE_ID)
    public TextChangeDetailResponse detail(@PathVariable Long analysisId, @PathVariable Long changeId) {
        return TextChangeDetailResponse.from(evidenceService.evidence(analysisId, changeId));
    }

    @GetMapping
    public TextChangeListResponse list(@PathVariable Long analysisId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "priority") String sort,
            @RequestParam(required = false) String section,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (!"priority".equals(sort) && !"document".equals(sort)) {
            throw ApiException.invalidInput("sort", "priority 또는 document여야 합니다.");
        }
        if (type != null && !TYPES.contains(type)) {
            throw ApiException.invalidInput("type", String.join(", ", TextChangeRow.TYPES) + " 중 하나여야 합니다.");
        }
        if (page < 0) {
            throw ApiException.invalidInput("page", "0 이상이어야 합니다.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw ApiException.invalidInput("size", "1에서 " + MAX_SIZE + " 사이여야 합니다.");
        }
        String sectionTitle = blankToNull(section);
        if (sectionTitle != null && sectionTitle.length() > MAX_SECTION) {
            throw ApiException.invalidInput("section", MAX_SECTION + "자 이하여야 합니다.");
        }
        String query = blankToNull(q);
        if (query != null && (query.length() < MIN_QUERY || query.length() > MAX_QUERY)) {
            throw ApiException.invalidInput("q", MIN_QUERY + "자 이상 " + MAX_QUERY + "자 이하로 입력해 주세요.");
        }
        long offset = (long) page * size; // 큰 page에서 int가 넘쳐 음수가 되지 않게
        TextChangePage result = queryService.page(analysisId, new TextChangeFilter(type, sectionTitle, query),
                "priority".equals(sort), offset, size);
        Analysis analysis = result.analysis();
        Counts counts = Counts.of(result.counts());
        int total = type == null ? counts.all() : result.counts().get(type);
        List<SectionView> sections = result.sections().stream().map(SectionView::from).toList();
        List<TextChangeItemResponse> items = result.changes().stream().map(TextChangeItemResponse::from).toList();
        return new TextChangeListResponse(analysisId, analysis.getTextStatus(), analysis.getTextMessage(), type,
                sort, sectionTitle, query, page, size, total, counts, sections, items);
    }

    /** 앞뒤 공백을 지운 값. 비었으면 거르지 않는다(null) */
    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
