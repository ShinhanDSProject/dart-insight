package com.dartinsight.followup.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.followup.dto.CompanyPlanFollowupResponse;
import com.dartinsight.followup.service.PlanFollowupService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 약속과 실제 대조 API(docs/api-spec.md GET /api/companies/{corpCode}/plan-followups, ADR-0041). 기업 화면 개요 탭.
 */
@RestController
@RequestMapping(ApiPaths.COMPANY_PLAN_FOLLOWUPS)
@RequiredArgsConstructor
public class PlanFollowupController {

    private final PlanFollowupService planFollowupService;

    @GetMapping
    public CompanyPlanFollowupResponse get(@PathVariable String corpCode) {
        return planFollowupService.get(corpCode);
    }
}
