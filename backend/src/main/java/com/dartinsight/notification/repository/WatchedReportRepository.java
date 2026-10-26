package com.dartinsight.notification.repository;

import com.dartinsight.notification.domain.WatchedReport;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WatchedReportRepository extends JpaRepository<WatchedReport, Long> {
    boolean existsByRceptNo(String rceptNo);
}
