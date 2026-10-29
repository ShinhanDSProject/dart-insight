package com.dartinsight.community.repository;

import com.dartinsight.community.domain.CommunityComment;
import com.dartinsight.community.domain.ContentStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, Long> {
    /** 댓글 행을 잠근다. 좋아요 수를 한 줄로 세워 고친다 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CommunityComment c where c.id = :id")
    Optional<CommunityComment> findByIdForUpdate(@Param("id") Long id);

    List<CommunityComment> findByPostIdOrderByCreatedAtAscIdAsc(Long postId);

    List<CommunityComment> findByParentIdOrderByCreatedAtAscIdAsc(Long parentId);

    boolean existsByParentIdAndStatusNot(Long parentId, ContentStatus status);
}
