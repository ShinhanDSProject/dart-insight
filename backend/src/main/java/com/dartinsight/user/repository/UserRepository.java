package com.dartinsight.user.repository;

import com.dartinsight.user.domain.User;
import com.dartinsight.user.domain.UserRole;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {
    /** 회원 행을 잠근다(SELECT … FOR UPDATE). 트랜잭션이 끝나면 풀린다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    /** 대소문자만 다른 닉네임도 같은 것으로 본다(API 명세 6.6). */
    boolean existsByNicknameIgnoreCaseAndIdNot(String nickname, Long id);

    long countByRole(UserRole role);

    /** [from, to)에 가입한 회원의 가입 시각 */
    @Query("select u.createdAt from User u where u.createdAt >= :from and u.createdAt < :to")
    List<LocalDateTime> findCreatedAts(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * 관리자 회원 목록(GET /api/admin/users). 조건이 null이면 그 조건으로 거르지 않는다. 가입 최근 순(같으면 ID 큰 순).
     *
     * @param nicknamePattern 소문자 닉네임 LIKE 패턴('!' 이스케이프)
     * @param email 소문자 이메일. 일반 가입·소셜 계정 이메일과 대소문자 없이 전체 일치
     */
    @Query("select u from User u where (:role is null or u.role = :role)"
            + " and (:email is null or lower(u.nickname) like :nicknamePattern escape '!'"
            + " or exists (select c.id from LocalCredential c where c.user = u and lower(c.email) = :email)"
            + " or exists (select a.id from SocialAccount a where a.userId = u.id and lower(a.email) = :email))"
            + " order by u.createdAt desc, u.id desc")
    Page<User> search(@Param("role") UserRole role, @Param("nicknamePattern") String nicknamePattern,
            @Param("email") String email, Pageable pageable);
}
