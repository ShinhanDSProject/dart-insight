package com.dartinsight.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SocialAuthenticationServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final SocialAccountRepository accounts = mock(SocialAccountRepository.class);
    private final SocialAuthenticationService service = new SocialAuthenticationService(users, accounts,
            Clock.fixed(Instant.parse("2026-10-24T00:00:00Z"), ZoneOffset.UTC));

    @Test
    void reusesUserForExistingProviderIdentity() {
        var identity = new SocialIdentity("google", "provider-user", "member@example.com", true);
        var account = SocialAccount.create(42L, identity,
                java.time.LocalDateTime.of(2026, 10, 24, 9, 0));
        when(accounts.findByProviderAndProviderUserId("google", "provider-user"))
                .thenReturn(Optional.of(account));

        assertThat(service.authenticate(identity)).isEqualTo(42L);
        verify(users, never()).saveAndFlush(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("제공자가 이메일을 주지 않아도 사용자 ID가 있으면 새 회원으로 로그인한다")
    void createsUserWhenProviderOmitsEmail() {
        var identity = new SocialIdentity("kakao", "kakao-user", null, false);
        User saved = mock(User.class);
        when(saved.getId()).thenReturn(7L);
        when(accounts.findByProviderAndProviderUserId("kakao", "kakao-user")).thenReturn(Optional.empty());
        when(users.saveAndFlush(org.mockito.ArgumentMatchers.any())).thenReturn(saved);

        assertThat(service.authenticate(identity)).isEqualTo(7L);
        verify(accounts).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("제공자 사용자 ID가 없으면 로그인을 거부한다")
    void rejectsIdentityWithoutProviderUserId() {
        var identity = new SocialIdentity("naver", " ", "member@example.com", false);

        assertThatThrownBy(() -> service.authenticate(identity)).isInstanceOf(IllegalArgumentException.class);
        verify(users, never()).saveAndFlush(org.mockito.ArgumentMatchers.any());
    }
}
