package com.dartinsight.community.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.community.dto.CommentCreateRequest;
import com.dartinsight.community.dto.CommentResponse;
import com.dartinsight.community.dto.CommunityBodyRequest;
import com.dartinsight.community.dto.LikeResponse;
import com.dartinsight.community.dto.PostDetailResponse;
import com.dartinsight.community.dto.PostResponse;
import com.dartinsight.community.dto.ReportRequest;
import com.dartinsight.community.service.CommunityCommentService;
import com.dartinsight.community.service.CommunityLikeService;
import com.dartinsight.community.service.CommunityPostService;
import com.dartinsight.community.service.CommunityReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 커뮤니티 글 하나와 그 댓글·좋아요·신고(docs/api-spec.md 6.6 커뮤니티). 글 읽기만 로그인 없이 된다. */
@RestController
@RequestMapping(ApiPaths.POSTS)
@RequiredArgsConstructor
public class PostController {
    private final CommunityPostService postService;
    private final CommunityCommentService commentService;
    private final CommunityLikeService likeService;
    private final CommunityReportService reportService;

    @GetMapping(ApiPaths.BY_POST_ID)
    public PostDetailResponse detail(@AuthenticationPrincipal Jwt jwt, @PathVariable long postId) {
        return postService.detail(postId, viewerId(jwt));
    }

    @PatchMapping(ApiPaths.BY_POST_ID)
    public PostResponse edit(@AuthenticationPrincipal Jwt jwt, @PathVariable long postId,
            @RequestBody CommunityBodyRequest request) {
        return postService.edit(postId, userId(jwt), request.body());
    }

    @DeleteMapping(ApiPaths.BY_POST_ID)
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long postId) {
        postService.delete(postId, userId(jwt));
        return ResponseEntity.noContent().build();
    }

    @PostMapping(ApiPaths.POST_COMMENTS)
    public ResponseEntity<CommentResponse> comment(@AuthenticationPrincipal Jwt jwt, @PathVariable long postId,
            @RequestBody CommentCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                commentService.create(postId, userId(jwt), request.body(), request.parentId()));
    }

    @PutMapping(ApiPaths.POST_LIKE)
    public LikeResponse like(@AuthenticationPrincipal Jwt jwt, @PathVariable long postId) {
        return likeService.likePost(postId, userId(jwt));
    }

    @DeleteMapping(ApiPaths.POST_LIKE)
    public LikeResponse unlike(@AuthenticationPrincipal Jwt jwt, @PathVariable long postId) {
        return likeService.unlikePost(postId, userId(jwt));
    }

    @PostMapping(ApiPaths.POST_REPORTS)
    public ResponseEntity<Void> report(@AuthenticationPrincipal Jwt jwt, @PathVariable long postId,
            @RequestBody ReportRequest request) {
        reportService.reportPost(postId, userId(jwt), request.reason());
        return ResponseEntity.noContent().build();
    }

    /** 쓰기 경로는 SecurityConfig가 로그인을 요구해 토큰이 언제나 있다 */
    private static long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }

    /** 읽기는 로그인 없이 되므로 토큰이 없으면 null */
    private static Long viewerId(Jwt jwt) {
        return jwt == null ? null : userId(jwt);
    }
}
