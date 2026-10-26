package com.dartinsight.user;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SocialAuthenticationService {
    private final UserRepository users;
    private final SocialAccountRepository socialAccounts;
    private final Clock clock;

    @Transactional
    public long authenticate(SocialIdentity identity) {
        validate(identity);
        return socialAccounts.findByProviderAndProviderUserId(identity.provider(), identity.providerUserId())
                .map(SocialAccount::userId)
                .orElseGet(() -> create(identity));
    }

    private long create(SocialIdentity identity) {
        LocalDateTime now = LocalDateTime.now(clock);
        User user = users.saveAndFlush(User.create(now));
        socialAccounts.save(SocialAccount.create(user.getId(), identity, now));
        return user.getId();
    }

    private void validate(SocialIdentity identity) {
        // 이메일은 제공자·동의 여부에 따라 없을 수 있어 확인하지 않는다(연결 키는 provider + providerUserId, ADR-0022).
        if (identity == null || identity.provider() == null
                || identity.providerUserId() == null || identity.providerUserId().isBlank()) {
            throw new IllegalArgumentException("Social provider did not return a user id");
        }
        String provider = identity.provider().toLowerCase(Locale.ROOT);
        if (!provider.equals("google") && !provider.equals("kakao") && !provider.equals("naver")) {
            throw new IllegalArgumentException("Unsupported social provider");
        }
    }
}
