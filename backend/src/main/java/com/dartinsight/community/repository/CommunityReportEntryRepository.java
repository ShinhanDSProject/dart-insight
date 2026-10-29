package com.dartinsight.community.repository;

import com.dartinsight.community.domain.CommunityReportEntry;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommunityReportEntryRepository extends JpaRepository<CommunityReportEntry, Long> {
    boolean existsByReportIdAndReporterId(Long reportId, Long reporterId);

    /** 신고 건별·사유별 신고 수. 신고한 사람은 읽지 않는다 */
    @Query("select e.reportId as reportId, e.reason as reason, count(e) as count from CommunityReportEntry e"
            + " where e.reportId in :reportIds group by e.reportId, e.reason")
    List<ReasonCount> countReasons(@Param("reportIds") Collection<Long> reportIds);
}
