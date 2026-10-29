package com.dartinsight.community.dto;

import java.util.List;

/** GET /api/posts/{postId}. 댓글은 오래된 순, 답글도 부모 아래에서 오래된 순 */
public record PostDetailResponse(PostResponse post, List<CommentResponse> comments) {}
