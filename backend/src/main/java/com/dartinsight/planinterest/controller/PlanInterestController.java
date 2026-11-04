package com.dartinsight.planinterest.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.planinterest.dto.PlanInterestRequest;
import com.dartinsight.planinterest.service.PlanInterestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 요금제 '관심 있어요'(docs/api-spec.md POST /api/plan-interests, FS-73). 로그인 없이도 쓴다.
 * 잘못된 토큰은 SecurityConfig가 이 경로에서만 무시하므로 jwt는 유효한 토큰일 때만 있다.
 */
@RestController
@RequestMapping(ApiPaths.PLAN_INTERESTS)
@RequiredArgsConstructor
public class PlanInterestController {
    private final PlanInterestService planInterestService;

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void record(@AuthenticationPrincipal Jwt jwt, @RequestBody PlanInterestRequest request) {
        planInterestService.record(jwt == null ? null : Long.parseLong(jwt.getSubject()), request);
    }
}
