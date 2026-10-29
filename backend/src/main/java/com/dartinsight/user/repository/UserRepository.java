package com.dartinsight.user.repository;

import com.dartinsight.user.domain.User;
import jakarta.persistence.LockModeType;
import java.util.Optional;
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
}
