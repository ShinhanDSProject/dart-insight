package com.dartinsight.report.repository;

import com.dartinsight.report.domain.Report;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, Long> {

    Optional<Report> findByRceptNo(String rceptNo);

    List<Report> findByRceptNoIn(Collection<String> rceptNos);

    boolean existsByCorpCode(String corpCode);

    /** 최신 목록에서 본 보고서. 대상 기간이 최근인 순서. */
    List<Report> findByCorpCodeAndLastSeenAtGreaterThanEqualOrderByPeriodEndDescRceptDtDesc(String corpCode,
            LocalDateTime seenSince);
}
