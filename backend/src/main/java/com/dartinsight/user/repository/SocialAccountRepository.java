package com.dartinsight.user.repository;

import com.dartinsight.user.domain.SocialAccount;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SocialAccountRepository extends JpaRepository<SocialAccount, Long> {
    Optional<SocialAccount> findByProviderAndProviderUserId(String provider, String providerUserId);

    /** 제공자가 확인했다고 한 이메일만(ADR-0040). */
    @Query("select a.email from SocialAccount a where a.userId = :userId and a.emailVerified = true"
            + " and a.email is not null")
    List<String> findVerifiedEmails(@Param("userId") long userId);
}
