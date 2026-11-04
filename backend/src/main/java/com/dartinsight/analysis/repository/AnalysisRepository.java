package com.dartinsight.analysis.repository;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.AnalysisStatus;
import com.dartinsight.comparison.domain.ComparisonBasis;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnalysisRepository extends JpaRepository<Analysis, Long> {

    /** 같은 조건의 분석, 최근 것부터 */
    List<Analysis> findByCorpCodeAndCurrentRceptNoAndPreviousRceptNoAndBasisAndAnalysisVersionOrderByIdDesc(
            String corpCode, String currentRceptNo, String previousRceptNo, ComparisonBasis basis,
            String analysisVersion);

    /** 이 기업의 이 상태 분석, 완료 시각이 최근인 것부터 */
    List<Analysis> findByCorpCodeAndStatusOrderByCompletedAtDescIdDesc(String corpCode, AnalysisStatus status);

    /** 이 시각 전에 만들어졌고 아직 끝나지 않은 분석(서버 재시작 정리용) */
    List<Analysis> findByStatusInAndCreatedAtBefore(Collection<AnalysisStatus> statuses, LocalDateTime createdAt);

    /** [from, to)에 요청한 분석(관리자 개요) */
    List<Analysis> findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(LocalDateTime from, LocalDateTime to);

    /**
     * 관리자 분석 작업 목록(GET /api/admin/analyses). null인 조건으로는 거르지 않는다. 검색어 조건(ID·고유번호·추적 ID·
     * 기업명 패턴)은 하나라도 맞으면 찾고, 모두 null이면 검색어 없이 찾는다. 요청 최근 순(같으면 ID 큰 순).
     *
     * @param corpNamePattern 기업명 LIKE 패턴('!' 이스케이프)
     */
    @Query("select a from Analysis a where (:status is null or a.status = :status)"
            + " and (:createdFrom is null or a.createdAt >= :createdFrom)"
            + " and ((:id is null and :corpCode is null and :traceId is null and :corpNamePattern is null)"
            + " or a.id = :id or a.corpCode = :corpCode or a.requestTraceId = :traceId"
            + " or exists (select c.id from Company c where c.corpCode = a.corpCode"
            + " and c.corpName like :corpNamePattern escape '!'))"
            + " order by a.createdAt desc, a.id desc")
    Page<Analysis> search(@Param("status") AnalysisStatus status, @Param("createdFrom") LocalDateTime createdFrom,
            @Param("id") Long id, @Param("corpCode") String corpCode, @Param("traceId") String traceId,
            @Param("corpNamePattern") String corpNamePattern, Pageable pageable);
}
