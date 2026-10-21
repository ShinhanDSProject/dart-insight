package com.dartinsight.analysis;

import com.dartinsight.comparison.ComparisonBasis;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisRepository extends JpaRepository<Analysis, Long> {

    /** 같은 조건의 분석, 최근 것부터 */
    List<Analysis> findByCorpCodeAndCurrentRceptNoAndPreviousRceptNoAndBasisAndAnalysisVersionOrderByIdDesc(
            String corpCode, String currentRceptNo, String previousRceptNo, ComparisonBasis basis,
            String analysisVersion);
}
