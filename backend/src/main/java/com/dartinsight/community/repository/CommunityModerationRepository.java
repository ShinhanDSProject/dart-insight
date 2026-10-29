package com.dartinsight.community.repository;

import com.dartinsight.community.domain.CommunityModeration;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityModerationRepository extends JpaRepository<CommunityModeration, Long> {
    /** 신고 건들의 처리 기록, 최근 순 */
    List<CommunityModeration> findByReportIdInOrderByCreatedAtDescIdDesc(Collection<Long> reportIds);
}
