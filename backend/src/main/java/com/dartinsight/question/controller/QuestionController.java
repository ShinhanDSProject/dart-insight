package com.dartinsight.question.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.question.dto.QuestionListResponse;
import com.dartinsight.question.dto.QuestionRequest;
import com.dartinsight.question.dto.QuestionResponse;
import com.dartinsight.question.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 근거로 답하는 질문(3.10, ADR-0019). 화면 W-03 ⑤. 동기 호출이다(작업 ID 없음).
 * 답의 [1]은 citations[].no(원문 위치), [F1]은 facts[].ref(코드가 계산한 사실)다.
 */
@RestController
@RequestMapping(ApiPaths.ANALYSIS_QUESTIONS)
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    @PostMapping
    public QuestionResponse ask(@PathVariable Long analysisId, @RequestBody QuestionRequest request) {
        return questionService.ask(analysisId, request.question());
    }

    @GetMapping
    public QuestionListResponse history(@PathVariable Long analysisId) {
        return questionService.history(analysisId);
    }
}
