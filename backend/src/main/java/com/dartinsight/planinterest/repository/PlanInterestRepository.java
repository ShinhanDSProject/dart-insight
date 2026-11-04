package com.dartinsight.planinterest.repository;

import com.dartinsight.planinterest.domain.PlanInterest;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanInterestRepository extends JpaRepository<PlanInterest, Long> {
    /** [from, to)에 남긴 기록 */
    List<PlanInterest> findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(LocalDateTime from, LocalDateTime to);
}
