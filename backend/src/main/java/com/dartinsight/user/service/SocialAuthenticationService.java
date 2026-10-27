package com.dartinsight.user.service;

import com.dartinsight.user.domain.SocialAccount;
import com.dartinsight.user.domain.SocialIdentity;
import com.dartinsight.user.domain.User;
import com.dartinsight.user.repository.SocialAccountRepository;
import com.dartinsight.user.repository.UserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
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
        SocialIdentity.requireValid(identity);
        return socialAccounts.findByProviderAndProviderUserId(identity.provider(), identity.providerUserId())
                .map(SocialAccount::getUserId)
                .orElseGet(() -> create(identity));
    }

    private long create(SocialIdentity identity) {
        LocalDateTime now = LocalDateTime.now(clock);
        User user = users.saveAndFlush(User.create(now));
        socialAccounts.save(SocialAccount.create(user.getId(), identity, now));
        return user.getId();
    }
}
