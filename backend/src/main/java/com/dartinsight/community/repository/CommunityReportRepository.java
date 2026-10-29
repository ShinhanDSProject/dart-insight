package com.dartinsight.community.repository;

import com.dartinsight.community.domain.CommunityReport;
import com.dartinsight.community.domain.ReportStatus;
import com.dartinsight.community.domain.TargetType;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommunityReportRepository extends JpaRepository<CommunityReport, Long> {
    /** 신고 건 행을 잠근다. 처리·재게시 청구를 한 줄로 세운다 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CommunityReport r where r.id = :id")
    Optional<CommunityReport> findByIdForUpdate(@Param("id") Long id);

    /** 대상의 신고 건을 잠근다. 신고를 더할 때 쓴다 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CommunityReport r where r.targetType = :targetType and r.targetId = :targetId")
    Optional<CommunityReport> findByTargetForUpdate(@Param("targetType") TargetType targetType,
            @Param("targetId") Long targetId);

    /** 신고 건의 대상만 읽는다. 엔티티를 올리지 않아 뒤의 잠금 조회가 최신 행을 받는다 */
    @Query("select r.targetType as targetType, r.targetId as targetId, r.postId as postId"
            + " from CommunityReport r where r.id = :id")
    Optional<ReportTargetRef> findTargetById(@Param("id") Long id);

    List<CommunityReport> findByTargetTypeAndTargetIdIn(TargetType targetType, Collection<Long> targetIds);

    /** '처리할 것' 후보(대기·블라인드). 처리할 이유는 읽은 뒤 정한다 */
    List<CommunityReport> findByStatusIn(Collection<ReportStatus> statuses);

    Page<CommunityReport> findAllByOrderByLastReportedAtDescIdDesc(Pageable pageable);
}
