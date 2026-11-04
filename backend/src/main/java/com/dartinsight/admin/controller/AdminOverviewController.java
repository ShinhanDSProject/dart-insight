package com.dartinsight.admin.controller;

import com.dartinsight.admin.dto.AdminOverviewResponse;
import com.dartinsight.admin.service.AdminOverviewService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 개요(docs/api-spec.md GET /api/admin/overview, FS-72). 관리자인지는 SecurityConfig가 확인한다(ADR-0040). */
@RestController
@RequestMapping(ApiPaths.ADMIN_OVERVIEW)
@RequiredArgsConstructor
public class AdminOverviewController {
    private final AdminOverviewService adminOverviewService;

    @GetMapping
    public AdminOverviewResponse overview(@RequestParam(defaultValue = "7") int days) {
        return adminOverviewService.overview(days);
    }
}
