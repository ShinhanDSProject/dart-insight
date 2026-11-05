package com.dartinsight.auth.repository;

import com.dartinsight.auth.domain.PasswordResetToken;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    /** 같은 링크를 동시에 두 번 써도 한 번만 성공하게 잠근다 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from PasswordResetToken token where token.tokenHash = :hash")
    Optional<PasswordResetToken> findForUpdate(@Param("hash") String hash);

    boolean existsByUserIdAndCreatedAtAfter(long userId, LocalDateTime since);

    /** 새 링크를 만들 때 그 회원의 아직 쓰지 않은 이전 링크를 못 쓰게 한다 */
    @Modifying
    @Query("update PasswordResetToken token set token.usedAt = :now where token.userId = :userId and token.usedAt is null")
    int retireUnused(@Param("userId") long userId, @Param("now") LocalDateTime now);
}
