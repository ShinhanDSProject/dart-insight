package com.dartinsight.analysis.controller;

import com.dartinsight.analysis.domain.TextChangeFilter;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.dto.TextChangeDetailResponse;
import com.dartinsight.analysis.dto.TextChangeHistoryResponse;
import com.dartinsight.analysis.dto.TextChangeListResponse;
import com.dartinsight.analysis.service.TextChangeHistoryService;
import com.dartinsight.analysis.service.TextChangeQueryService.TextChangePage;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.ApiPaths;
import java.util.LinkedHashSet;
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
 * 유형(type, 쉼표로 여러 개 #304)·최상위 섹션(section)·검색어(q)·위험 관련 목차(risk, 3.9)로 함께 거를 수 있다(3.7).
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
    private final TextChangeHistoryService historyService;

    /** 문장·표 근거 상세(3.4). 변경 전·후 원문 전체와 보고서·항목·위치 */
    @GetMapping(ApiPaths.BY_CHANGE_ID)
    public TextChangeDetailResponse detail(@PathVariable Long analysisId, @PathVariable Long changeId) {
        return TextChangeDetailResponse.from(evidenceService.evidence(analysisId, changeId));
    }

    /** 문장 변경 이력(3.8). 완료된 분석을 이어 붙여 여러 기간에 걸쳐 언제 바뀌었는지 */
    @GetMapping(ApiPaths.CHANGE_HISTORY)
    public TextChangeHistoryResponse history(@PathVariable Long analysisId, @PathVariable Long changeId) {
        return TextChangeHistoryResponse.of(analysisId, changeId, historyService.history(analysisId, changeId));
    }

    @GetMapping
    public TextChangeListResponse list(@PathVariable Long analysisId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "priority") String sort,
            @RequestParam(required = false) String section,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean risk,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (!"priority".equals(sort) && !"document".equals(sort)) {
            throw ApiException.invalidInput("sort", "priority 또는 document여야 합니다.");
        }
        List<String> types = parseTypes(type);
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
        TextChangeFilter filter = new TextChangeFilter(types, sectionTitle, query, risk);
        TextChangePage result = queryService.page(analysisId, filter, "priority".equals(sort), offset, size);
        return TextChangeListResponse.of(analysisId, filter, sort, page, size, result);
    }

    /**
     * 쉼표로 이은 유형(#304). 값마다 앞뒤 공백을 지우고 겹친 값은 처음 것만 둔다(처음 나온 순서).
     * 없거나 빈 값이면 빈 목록(전체). 알 수 없는 값(빈 항목 포함)이 하나라도 있으면 400
     */
    private static List<String> parseTypes(String type) {
        String value = blankToNull(type);
        if (value == null) {
            return List.of();
        }
        Set<String> types = new LinkedHashSet<>();
        for (String part : value.split(TextChangeFilter.TYPE_SEPARATOR, -1)) {
            String name = part.strip();
            if (!TYPES.contains(name)) {
                throw ApiException.invalidInput("type",
                        String.join(", ", TextChangeRow.TYPES) + " 중 하나 이상을 쉼표로 이어야 합니다.");
            }
            types.add(name);
        }
        return List.copyOf(types);
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
