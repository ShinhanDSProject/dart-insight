package com.dartinsight.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class SocialIdentityExtractorTest {
    private final SocialIdentityExtractor extractor = new SocialIdentityExtractor();

    @Test
    void extractsGoogleIdentity() {
        var identity = extractor.extract("google",
                Map.of("sub", "google-1", "email", "member@example.com", "email_verified", true));
        assertThat(identity.provider()).isEqualTo("google");
        assertThat(identity.providerUserId()).isEqualTo("google-1");
        assertThat(identity.emailVerified()).isTrue();
    }

    @Test
    void extractsKakaoIdentity() {
        var identity = extractor.extract("kakao", Map.of("id", 1234L, "kakao_account",
                Map.of("email", "member@kakao.com", "is_email_valid", true, "is_email_verified", true)));
        assertThat(identity.providerUserId()).isEqualTo("1234");
        assertThat(identity.email()).isEqualTo("member@kakao.com");
        assertThat(identity.emailVerified()).isTrue();
    }

    @Test
    void extractsNaverNestedResponse() {
        var identity = extractor.extract("naver",
                Map.of("response", Map.of("id", "naver-1", "email", "member@naver.com")));
        assertThat(identity.providerUserId()).isEqualTo("naver-1");
        assertThat(identity.email()).isEqualTo("member@naver.com");
    }
}
