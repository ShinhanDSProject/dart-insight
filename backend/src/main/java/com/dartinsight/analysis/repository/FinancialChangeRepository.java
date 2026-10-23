package com.dartinsight.analysis.repository;

import com.dartinsight.analysis.domain.FinancialChange;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancialChangeRepository extends JpaRepository<FinancialChange, Long> {

    List<FinancialChange> findByAnalysisIdOrderBySjDivAscDisplayOrderAsc(Long analysisId);

    Optional<FinancialChange> findByIdAndAnalysisId(Long id, Long analysisId);
}
