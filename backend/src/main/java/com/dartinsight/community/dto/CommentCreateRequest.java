package com.dartinsight.community.dto;

/** POST /api/posts/{postId}/comments. parentId는 답글일 때 이 글의 댓글 ID */
public record CommentCreateRequest(Object body, Long parentId) {}
