package com.dartinsight.analysis.controller;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.dto.TextChangeDetailResponse;
import com.dartinsight.analysis.dto.TextChangeItemResponse;
import com.dartinsight.analysis.dto.TextChangeListResponse.Counts;
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
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_TEXT_CHANGES)
@RequiredArgsConstructor
public class TextChangeController {

    private static final Set<String> TYPES = Set.of(TextChangeRow.ADDED, TextChangeRow.DELETED,
            TextChangeRow.MODIFIED, TextChangeRow.REVIEW_NEEDED);
    private static final int MAX_SIZE = 100;

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
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (!"priority".equals(sort) && !"document".equals(sort)) {
            throw ApiException.invalidInput("sort", "priority 또는 document여야 합니다.");
        }
        if (type != null && !TYPES.contains(type)) {
            throw ApiException.invalidInput("type", "ADDED, DELETED, MODIFIED, REVIEW_NEEDED 중 하나여야 합니다.");
        }
        if (page < 0) {
            throw ApiException.invalidInput("page", "0 이상이어야 합니다.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw ApiException.invalidInput("size", "1에서 " + MAX_SIZE + " 사이여야 합니다.");
        }
        long offset = (long) page * size; // 큰 page에서 int가 넘쳐 음수가 되지 않게
        TextChangePage result = queryService.page(analysisId, type, "priority".equals(sort), offset, size);
        Analysis analysis = result.analysis();
        Counts counts = Counts.of(result.counts());
        int total = type == null ? counts.all() : result.counts().get(type);
        List<TextChangeItemResponse> items = result.changes().stream().map(TextChangeItemResponse::from).toList();
        return new TextChangeListResponse(analysisId, analysis.getTextStatus(), analysis.getTextMessage(), type,
                sort, page, size, total, counts, items);
    }
}
