package com.dartinsight.auth.config;

import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.common.web.ApiPaths;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;

@Configuration
@EnableConfigurationProperties(AuthProperties.class)
public class SecurityConfig {
    @Bean
    public SecretKey jwtSecretKey(AuthProperties properties) {
        byte[] bytes = properties.jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey key) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    @Bean
    public JwtDecoder jwtDecoder(SecretKey key, AuthProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.issuer()));
        return decoder;
    }

    // OAuth2 Authorization Code 흐름은 state를 서버 세션에 둬야 해서, 소셜 로그인 경로만 세션을 쓴다.
    // 콜백에서 서비스 토큰으로 바꾼 뒤 세션을 폐기한다.
    @Bean
    @Order(1)
    public SecurityFilterChain socialLoginFilterChain(HttpSecurity http) throws Exception {
        // failureUrl로 redirect하면 기본 로그인 페이지 필터가 그 주소를 가로채 HTML을 그리므로 forward한다.
        var failure = new SimpleUrlAuthenticationFailureHandler(ApiPaths.SOCIAL_SESSION_FAILURE);
        failure.setUseForward(true);
        http.securityMatcher(ApiPaths.OAUTH2_AUTHORIZATION, ApiPaths.OAUTH2_CALLBACK,
                        ApiPaths.SOCIAL_SESSIONS + "/**")
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .oauth2Login(oauth -> oauth.defaultSuccessUrl(ApiPaths.SOCIAL_SESSION_CALLBACK, true)
                        .failureHandler(failure));
        return http.build();
    }

    // 나머지 API는 세션 없이 Bearer JWT로만 인증한다.
    // 관리자 API는 그 위에 요청마다 DB의 역할을 확인한다(ADR-0040, auth/service/AdminAuthorizationManager).
    @Bean
    @Order(2)
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
            AuthorizationManager<RequestAuthorizationContext> adminAuthorizationManager, JwtDecoder jwtDecoder)
            throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, ApiPaths.CURRENT_SESSION).authenticated()
                        .requestMatchers(ApiPaths.FAVORITE_COMPANIES, ApiPaths.FAVORITE_COMPANIES + "/**").authenticated()
                        .requestMatchers(ApiPaths.NOTIFICATIONS, ApiPaths.NOTIFICATIONS + "/**").authenticated()
                        .requestMatchers(ApiPaths.NOTES, ApiPaths.NOTES + "/**").authenticated()
                        .requestMatchers(ApiPaths.CURRENT_USER, ApiPaths.CURRENT_USER + "/**").authenticated()
                        // 커뮤니티는 읽기(GET)만 로그인 없이 되고 쓰기는 로그인이 필요하다(6.6)
                        .requestMatchers(HttpMethod.GET, ApiPaths.COMPANY_POSTS, ApiPaths.POSTS + "/**").permitAll()
                        .requestMatchers(ApiPaths.COMPANY_POSTS, ApiPaths.POSTS + "/**", ApiPaths.COMMENTS + "/**")
                                .authenticated()
                        .requestMatchers(ApiPaths.REPORT_REPOST_REQUESTS).authenticated()
                        .requestMatchers(ApiPaths.ADMIN, ApiPaths.ADMIN + "/**").access(adminAuthorizationManager)
                        .anyRequest().permitAll())
                .exceptionHandling(exceptions -> exceptions.accessDeniedHandler((request, response, exception) ->
                        writeError(response, ErrorCode.AUTH_FORBIDDEN)))
                .oauth2ResourceServer(oauth -> oauth.bearerTokenResolver(bearerTokenResolver(jwtDecoder))
                        .jwt(Customizer.withDefaults())
                        .authenticationEntryPoint((request, response, exception) ->
                                writeError(response, ErrorCode.AUTH_UNAUTHORIZED)));
        return http.build();
    }

    /**
     * Authorization 헤더의 Bearer 토큰을 읽는다. 요금제 '관심 있어요'(POST /api/plan-interests, FS-73)만은
     * 토큰이 잘못됐으면 401 대신 토큰이 없는 것으로 본다(이 기록만을 위해 다시 로그인하게 하지 않음).
     * 그 경로는 확인하려고 한 번 더 디코딩한다.
     */
    private static BearerTokenResolver bearerTokenResolver(JwtDecoder decoder) {
        DefaultBearerTokenResolver standard = new DefaultBearerTokenResolver();
        return request -> {
            if (!HttpMethod.POST.matches(request.getMethod())
                    || !ApiPaths.PLAN_INTERESTS.equals(request.getRequestURI())) {
                return standard.resolve(request);
            }
            try {
                String token = standard.resolve(request);
                if (token != null) decoder.decode(token);
                return token;
            } catch (OAuth2AuthenticationException | JwtException e) {
                return null;
            }
        };
    }

    // 컨트롤러 밖(보안 필터)에서 나는 401·403도 공통 에러 형식으로 쓴다. 메시지는 따옴표 없는 고정 문구다.
    private static void writeError(HttpServletResponse response, ErrorCode code) throws IOException {
        response.setStatus(code.status());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        String traceId = TraceContext.currentTraceId();
        response.getWriter().write("{\"code\":\"" + code.name() + "\",\"message\":\"" + code.defaultMessage()
                + "\",\"traceId\":\"" + (traceId == null ? "" : traceId) + "\",\"errors\":[]}");
    }
}
