package com.dartinsight.community.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.community.dto.CommentResponse;
import com.dartinsight.community.dto.CommunityBodyRequest;
import com.dartinsight.community.dto.LikeResponse;
import com.dartinsight.community.dto.ReportRequest;
import com.dartinsight.community.service.CommunityCommentService;
import com.dartinsight.community.service.CommunityLikeService;
import com.dartinsight.community.service.CommunityReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 커뮤니티 댓글 고치기·지우기·좋아요·신고(docs/api-spec.md 6.6 커뮤니티). 모두 로그인이 필요하다. */
@RestController
@RequestMapping(ApiPaths.COMMENTS)
@RequiredArgsConstructor
public class CommentController {
    private final CommunityCommentService commentService;
    private final CommunityLikeService likeService;
    private final CommunityReportService reportService;

    @PatchMapping(ApiPaths.BY_COMMENT_ID)
    public CommentResponse edit(@AuthenticationPrincipal Jwt jwt, @PathVariable long commentId,
            @RequestBody CommunityBodyRequest request) {
        return commentService.edit(commentId, userId(jwt), request.body());
    }

    @DeleteMapping(ApiPaths.BY_COMMENT_ID)
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long commentId) {
        commentService.delete(commentId, userId(jwt));
        return ResponseEntity.noContent().build();
    }

    @PutMapping(ApiPaths.COMMENT_LIKE)
    public LikeResponse like(@AuthenticationPrincipal Jwt jwt, @PathVariable long commentId) {
        return likeService.likeComment(commentId, userId(jwt));
    }

    @DeleteMapping(ApiPaths.COMMENT_LIKE)
    public LikeResponse unlike(@AuthenticationPrincipal Jwt jwt, @PathVariable long commentId) {
        return likeService.unlikeComment(commentId, userId(jwt));
    }

    @PostMapping(ApiPaths.COMMENT_REPORTS)
    public ResponseEntity<Void> report(@AuthenticationPrincipal Jwt jwt, @PathVariable long commentId,
            @RequestBody ReportRequest request) {
        reportService.reportComment(commentId, userId(jwt), request.reason());
        return ResponseEntity.noContent().build();
    }

    /** 쓰기 경로는 SecurityConfig가 로그인을 요구해 토큰이 언제나 있다 */
    private static long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
