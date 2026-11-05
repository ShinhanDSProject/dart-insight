package com.dartinsight.llmquota.controller;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.llmquota.domain.ClientAddress;
import com.dartinsight.llmquota.service.LlmQuotaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
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
 */
@Component
@RequiredArgsConstructor
public class LlmQuotaInterceptor implements HandlerInterceptor, WebMvcConfigurer {

    static final List<String> LIMITED_PATHS = List.of(
            ApiPaths.ANALYSIS_QUESTIONS, ApiPaths.COMPANY_QUESTIONS, ApiPaths.ANALYSIS_CHAT_MESSAGES);
    private static final String FORWARDED_FOR = "X-Forwarded-For";

    private final LlmQuotaService quota;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this)
                .addPathPatterns(LIMITED_PATHS.stream().map(path -> path.replaceAll("\\{[^/]+}", "*")).toList());
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!"POST".equals(request.getMethod())) {
            return true;
        }
        String clientIp = ClientAddress.resolve(request.getRemoteAddr(), request.getHeader(FORWARDED_FOR));
        try {
            quota.acquire(currentUserId(), clientIp);
        } catch (ApiException e) {
            response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(quota.secondsUntilReset()));
            throw e;
        }
        return true;
    }

    private static Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return Long.parseLong(jwt.getSubject());
        }
        return null;
    }
}
