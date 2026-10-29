package com.dartinsight.community.repository;

import com.dartinsight.community.domain.CommunityLike;
import com.dartinsight.community.domain.LikeTarget;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommunityLikeRepository extends JpaRepository<CommunityLike, Long> {
    Optional<CommunityLike> findByTargetTypeAndTargetIdAndUserId(LikeTarget targetType, Long targetId, Long userId);

    /** 회원이 좋아요를 누른 대상 ID(targetIds 중에서) */
    @Query("select l.targetId from CommunityLike l where l.targetType = :targetType"
            + " and l.userId = :userId and l.targetId in :targetIds")
    List<Long> findLikedTargetIds(@Param("targetType") LikeTarget targetType, @Param("userId") long userId,
            @Param("targetIds") Collection<Long> targetIds);
}
