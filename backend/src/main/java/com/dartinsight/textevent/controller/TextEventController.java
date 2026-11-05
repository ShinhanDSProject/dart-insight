package com.dartinsight.textevent.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.textevent.dto.TextEventDetailResponse;
import com.dartinsight.textevent.dto.TextEventListResponse;
import com.dartinsight.textevent.dto.TextEventRunResponse;
import com.dartinsight.textevent.service.TextEventQueryService;
import com.dartinsight.textevent.service.TextEventRunService;
import com.dartinsight.textevent.service.TextEventRunService.StartResult;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 주요 사건 만들기와 조회(3.36, ADR-0050). 분석 상태와 text-changes에는 영향을 주지 않는다. */
@RestController
@RequestMapping(ApiPaths.ANALYSES)
@RequiredArgsConstructor
public class TextEventController {

    private final TextEventRunService runService;
    private final TextEventQueryService queryService;

    /** 새로 시작했거나 진행 중이면 202, 이미 끝났거나 만들지 않으면 200 */
    @PostMapping(ApiPaths.ANALYSIS_EVENT_RUNS)
    public ResponseEntity<TextEventRunResponse> start(@PathVariable Long analysisId) {
        StartResult result = runService.start(analysisId);
        return ResponseEntity.status(result.accepted() ? HttpStatus.ACCEPTED : HttpStatus.OK)
                .body(TextEventRunResponse.from(result.run()));
    }

    @GetMapping(ApiPaths.ANALYSIS_CURRENT_EVENT_RUN)
    public TextEventRunResponse current(@PathVariable Long analysisId) {
        return TextEventRunResponse.from(runService.current(analysisId));
    }

    @GetMapping(ApiPaths.ANALYSIS_EVENTS)
    public TextEventListResponse events(@PathVariable Long analysisId) {
        return TextEventListResponse.from(queryService.events(analysisId));
    }

    @GetMapping(ApiPaths.ANALYSIS_EVENT)
    public TextEventDetailResponse event(@PathVariable Long analysisId, @PathVariable Long eventId) {
        return TextEventDetailResponse.from(queryService.event(analysisId, eventId));
    }
}
