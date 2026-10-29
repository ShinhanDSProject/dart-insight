package com.dartinsight.common.web;

import com.dartinsight.common.trace.TraceContext;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 화면(React 개발 서버)에서 /api/**를 부를 수 있게 CORS를 연다. PATCH는 커뮤니티 글·댓글 고치기가 쓴다.
 */
@Configuration
@EnableConfigurationProperties(WebConfig.CorsProperties.class)
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final CorsProperties corsProperties;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping(ApiPaths.CORS_PATTERN)
                .allowedOrigins(corsProperties.allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .allowCredentials(true)
                .exposedHeaders(TraceContext.HEADER);
    }

    @ConfigurationProperties(prefix = "app.cors")
    public record CorsProperties(@DefaultValue("http://localhost:5173") List<String> allowedOrigins) {
    }
}
