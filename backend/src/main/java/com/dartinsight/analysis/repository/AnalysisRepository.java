package com.dartinsight.analysis.repository;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.comparison.domain.ComparisonBasis;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisRepository extends JpaRepository<Analysis, Long> {

    /** 같은 조건의 분석, 최근 것부터 */
    List<Analysis> findByCorpCodeAndCurrentRceptNoAndPreviousRceptNoAndBasisAndAnalysisVersionOrderByIdDesc(
            String corpCode, String currentRceptNo, String previousRceptNo, ComparisonBasis basis,
            String analysisVersion);

    /** 이 시각 전에 만들어졌고 아직 끝나지 않은 분석(서버 재시작 정리용) */
    List<Analysis> findByStatusInAndCreatedAtBefore(Collection<AnalysisStatus> statuses, LocalDateTime createdAt);
}
