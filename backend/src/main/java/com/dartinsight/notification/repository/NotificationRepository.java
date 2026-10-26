package com.dartinsight.notification.repository;

import com.dartinsight.notification.domain.Notification;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    /** 최근 순. 같은 시각이면 나중에 넣은 행이 앞이다. */
    List<Notification> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, Pageable page);

    long countByUserIdAndReadAtIsNull(Long userId);

    boolean existsByUserIdAndAnalysisId(Long userId, Long analysisId);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);
}
