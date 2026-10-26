package com.dartinsight.question.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.question.dto.CompanyQuestionListResponse;
import com.dartinsight.question.dto.CompanyQuestionResponse;
import com.dartinsight.question.dto.QuestionRequest;
import com.dartinsight.question.service.CompanyQuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사업보고서에 근거해 묻기(docs/api-spec.md POST·GET /api/companies/{corpCode}/questions, ADR-0029).
 * 기업 화면 개요 탭. 동기 호출이다. 답의 [1]은 citations[].no(원문 위치)다.
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_QUESTIONS)
@RequiredArgsConstructor
public class CompanyQuestionController {

    private final CompanyQuestionService companyQuestionService;

    @PostMapping
    public CompanyQuestionResponse ask(@PathVariable String corpCode, @RequestBody QuestionRequest request) {
        return companyQuestionService.ask(corpCode, request.question());
    }

    @GetMapping
    public CompanyQuestionListResponse history(@PathVariable String corpCode) {
        return companyQuestionService.history(corpCode);
    }
}
