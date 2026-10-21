package com.dartinsight.report;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, String> {

    boolean existsByCorpCode(String corpCode);

    /** 최신 목록에서 본 보고서. 대상 기간이 최근인 순서. */
    List<Report> findByCorpCodeAndLastSeenAtGreaterThanEqualOrderByPeriodEndDescRceptDtDesc(String corpCode,
            LocalDateTime seenSince);
}
