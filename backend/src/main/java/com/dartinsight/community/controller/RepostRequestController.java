package com.dartinsight.community.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.community.dto.RepostCreateRequest;
import com.dartinsight.community.dto.RepostCreateResponse;
import com.dartinsight.community.service.CommunityReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 블라인드된 글·댓글의 재게시 청구(docs/api-spec.md 6.6 커뮤니티). 작성자만, 로그인이 필요하다. */
@RestController
@RequestMapping(ApiPaths.REPORT_REPOST_REQUESTS)
@RequiredArgsConstructor
public class RepostRequestController {
    private final CommunityReportService reportService;

    /** 남길 말이 없으면 본문 없이 보내도 된다 */
    @PostMapping
    public ResponseEntity<RepostCreateResponse> create(@AuthenticationPrincipal Jwt jwt, @PathVariable long reportId,
            @RequestBody(required = false) RepostCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(reportService.requestRepost(reportId,
                Long.parseLong(jwt.getSubject()), request == null ? null : request.message()));
    }
}
