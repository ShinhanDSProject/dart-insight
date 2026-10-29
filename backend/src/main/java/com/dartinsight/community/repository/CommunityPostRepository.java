package com.dartinsight.community.repository;

import com.dartinsight.community.domain.CommunityPost;
import com.dartinsight.community.domain.ContentStatus;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {
    /** 글 행을 잠근다(SELECT … FOR UPDATE). 좋아요·댓글 수를 한 줄로 세워 고친다 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from CommunityPost p where p.id = :id")
    Optional<CommunityPost> findByIdForUpdate(@Param("id") Long id);

    /** 지운 글은 댓글이 남아 있을 때만 목록에 둔다. 최신순 */
    default Page<CommunityPost> findLatest(String corpCode, Pageable pageable) {
        return findLatest(corpCode, ContentStatus.DELETED, pageable);
    }

    /** 좋아요 수 + 댓글 수가 많은 순, 같으면 최신 */
    default Page<CommunityPost> findPopular(String corpCode, Pageable pageable) {
        return findPopular(corpCode, ContentStatus.DELETED, pageable);
    }

    @Query("select p from CommunityPost p where p.corpCode = :corpCode"
            + " and (p.status <> :deleted or p.commentCount > 0)"
            + " order by p.createdAt desc, p.id desc")
    Page<CommunityPost> findLatest(@Param("corpCode") String corpCode, @Param("deleted") ContentStatus deleted,
            Pageable pageable);

    @Query("select p from CommunityPost p where p.corpCode = :corpCode"
            + " and (p.status <> :deleted or p.commentCount > 0)"
            + " order by (p.likeCount + p.commentCount) desc, p.createdAt desc, p.id desc")
    Page<CommunityPost> findPopular(@Param("corpCode") String corpCode, @Param("deleted") ContentStatus deleted,
            Pageable pageable);
}
