package com.dartinsight.community.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.community.dto.PostCreateRequest;
import com.dartinsight.community.dto.PostListResponse;
import com.dartinsight.community.dto.PostResponse;
import com.dartinsight.community.service.CommunityPostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 기업 게시판 글 목록·쓰기(docs/api-spec.md 6.6 커뮤니티). 목록은 로그인 없이, 쓰기는 로그인이 필요하다. */
@RestController
@RequestMapping(ApiPaths.COMPANY_POSTS)
@RequiredArgsConstructor
public class CompanyPostController {
    private final CommunityPostService postService;

    @GetMapping
    public PostListResponse list(@AuthenticationPrincipal Jwt jwt, @PathVariable String corpCode,
            @RequestParam(required = false) String sort, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return postService.list(corpCode, sort, page, size, viewerId(jwt));
    }

    @PostMapping
    public ResponseEntity<PostResponse> create(@AuthenticationPrincipal Jwt jwt, @PathVariable String corpCode,
            @RequestBody PostCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(postService.create(corpCode, userId(jwt), request.body(), request.quote()));
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
