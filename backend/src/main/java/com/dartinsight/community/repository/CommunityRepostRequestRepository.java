package com.dartinsight.community.repository;

import com.dartinsight.community.domain.CommunityRepostRequest;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityRepostRequestRepository extends JpaRepository<CommunityRepostRequest, Long> {
    List<CommunityRepostRequest> findByModerationIdIn(Collection<Long> moderationIds);
}
