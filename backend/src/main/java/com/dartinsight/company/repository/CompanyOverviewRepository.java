package com.dartinsight.company.repository;

import com.dartinsight.company.domain.CompanyOverview;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyOverviewRepository extends JpaRepository<CompanyOverview, Long> {

    Optional<CompanyOverview> findByCorpCode(String corpCode);
}
