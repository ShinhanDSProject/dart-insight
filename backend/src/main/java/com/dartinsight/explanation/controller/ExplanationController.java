package com.dartinsight.explanation.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.explanation.dto.TextExplanationResponse;
import com.dartinsight.explanation.service.ExplanationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 문장 변경 AI 한 줄 풀이(3.11, FS-6). 화면 W-03 ③. 동기 호출이고, 변경마다 한 번만 만든다. */
@RestController
@RequestMapping(ApiPaths.TEXT_CHANGE_EXPLANATIONS)
@RequiredArgsConstructor
public class ExplanationController {

    private final ExplanationService explanationService;

    @PostMapping
    public TextExplanationResponse explain(@PathVariable Long analysisId, @PathVariable Long changeId) {
        return explanationService.explain(analysisId, changeId);
    }
}
