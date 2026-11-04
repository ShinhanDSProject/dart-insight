package com.dartinsight.user.repository;

import com.dartinsight.user.domain.LocalCredential;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LocalCredentialRepository extends JpaRepository<LocalCredential, Long> {
    boolean existsByEmail(String email);
    Optional<LocalCredential> findByEmail(String email);

    /** 소유를 확인한 이메일만(ADR-0040). */
    @Query("select c.email from LocalCredential c where c.user.id = :userId and c.emailVerified = true")
    List<String> findVerifiedEmails(@Param("userId") long userId);

    @Query("select c from LocalCredential c where c.user.id in :userIds")
    List<LocalCredential> findByUserIds(@Param("userIds") Collection<Long> userIds);

    /** 일반 가입이 있는 모든 회원 ID */
    @Query("select c.user.id from LocalCredential c")
    List<Long> findAllUserIds();
}
