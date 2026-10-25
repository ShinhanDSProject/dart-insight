package com.dartinsight.auth.service;

import com.dartinsight.user.SocialIdentity;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class SocialIdentityExtractor {
    public SocialIdentity extract(String provider, Map<String, Object> attributes) {
        return switch (provider) {
            case "google" -> identity(provider, attributes, "sub", "email", "email_verified");
            case "kakao" -> kakao(attributes);
            case "naver" -> naver(attributes);
            default -> throw new IllegalArgumentException("Unsupported social provider");
        };
    }

    private SocialIdentity kakao(Map<String, Object> attributes) {
        Map<String, Object> account = map(attributes.get("kakao_account"));
        boolean verified = booleanValue(account.get("is_email_valid"))
                && booleanValue(account.get("is_email_verified"));
        return new SocialIdentity("kakao", string(attributes.get("id")), string(account.get("email")), verified);
    }

    private SocialIdentity naver(Map<String, Object> attributes) {
        Map<String, Object> response = map(attributes.get("response"));
        return new SocialIdentity("naver", string(response.get("id")), string(response.get("email")), false);
    }

    private SocialIdentity identity(String provider, Map<String, Object> values, String id, String email,
            String verified) {
        return new SocialIdentity(provider, string(values.get(id)), string(values.get(email)),
                booleanValue(values.get(verified)));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }

    private String string(Object value) { return value == null ? null : String.valueOf(value); }

    private boolean booleanValue(Object value) {
        return value instanceof Boolean bool ? bool : Boolean.parseBoolean(String.valueOf(value));
    }
}
