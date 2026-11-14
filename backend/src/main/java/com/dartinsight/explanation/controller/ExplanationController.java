package com.dartinsight.explanation.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.explanation.dto.TextExplanationResponse;
import com.dartinsight.explanation.service.ExplanationService;
import com.dartinsight.llmquota.domain.QuotaCaller;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
    public TextExplanationResponse explain(@PathVariable Long analysisId, @PathVariable Long changeId,
            @AuthenticationPrincipal Jwt jwt, HttpServletRequest http) {
        // 새로 만들 때만 하루 한도로 센다(ADR-0069). 회원은 회원 ID, 아니면 클라이언트 IP
        QuotaCaller caller = QuotaCaller.of(jwt == null ? null : Long.parseLong(jwt.getSubject()),
                http.getRemoteAddr(), http.getHeader("X-Forwarded-For"));
        return explanationService.explain(analysisId, changeId, caller);
    }
}
