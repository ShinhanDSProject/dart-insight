package com.dartinsight.community.dto;

import java.util.List;

/** GET /api/companies/{corpCode}/posts */
public record PostListResponse(String corpCode, String sort, int page, int size, long totalItems,
        List<PostResponse> items) {}
