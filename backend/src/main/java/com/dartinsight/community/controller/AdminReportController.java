package com.dartinsight.community.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.community.dto.AdminReportListResponse;
import com.dartinsight.community.dto.AdminReportResponse;
import com.dartinsight.community.dto.ModerationRequest;
import com.dartinsight.community.service.CommunityModerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 신고 목록·처리(docs/api-spec.md 6.6 커뮤니티). 관리자인지는 SecurityConfig가 확인한다(ADR-0040). */
@RestController
@RequestMapping(ApiPaths.ADMIN_REPORTS)
@RequiredArgsConstructor
public class AdminReportController {
    private final CommunityModerationService moderationService;

    @GetMapping
    public AdminReportListResponse list(@RequestParam(required = false) String queue,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return moderationService.list(queue, page, size);
    }

    @PatchMapping(ApiPaths.BY_REPORT_ID)
    public AdminReportResponse moderate(@AuthenticationPrincipal Jwt jwt, @PathVariable long reportId,
            @RequestBody ModerationRequest request) {
        return moderationService.moderate(reportId, Long.parseLong(jwt.getSubject()), request);
    }
}
