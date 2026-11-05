package com.dartinsight.llmquota.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.llmquota.domain.QuotaCaller;
import com.dartinsight.llmquota.domain.QuotaKind;
import com.dartinsight.llmquota.service.LlmQuotaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 매번 LLM을 새로 부르는 공개 API(질문·에이전트 채팅)의 POST를 하루 한도로 막는다(ADR-0054).
 * 컨트롤러를 고치지 않고 스스로 MVC 인터셉터로 등록한다. LLM을 매번 부르는 공개 API를 더하면 {@link #LIMITED_PATHS}에 넣는다.
 * 한도를 넘으면 서비스가 던진 429에 공통 예외 처리가 Retry-After를 붙인다(ADR-0056).
 */
@Component
@RequiredArgsConstructor
public class LlmQuotaInterceptor implements HandlerInterceptor, WebMvcConfigurer {

    static final List<String> LIMITED_PATHS = List.of(
            ApiPaths.ANALYSIS_QUESTIONS, ApiPaths.COMPANY_QUESTIONS, ApiPaths.ANALYSIS_CHAT_MESSAGES);
    static final String FORWARDED_FOR = "X-Forwarded-For";

    private final LlmQuotaService quota;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this)
                .addPathPatterns(LIMITED_PATHS.stream().map(path -> path.replaceAll("\\{[^/]+}", "*")).toList());
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("POST".equals(request.getMethod())) {
            quota.acquire(QuotaKind.QUESTION, caller(request));
        }
        return true;
    }

    /** 요청의 호출자(회원 ID 또는 클라이언트 IP) */
    static QuotaCaller caller(HttpServletRequest request) {
        return QuotaCaller.of(currentUserId(), request.getRemoteAddr(), request.getHeader(FORWARDED_FOR));
    }

    private static Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return Long.parseLong(jwt.getSubject());
        }
        return null;
    }
}
