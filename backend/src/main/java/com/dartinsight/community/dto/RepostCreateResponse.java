package com.dartinsight.community.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/** POST /api/reports/{reportId}/repost-requests 201 응답 */
public record RepostCreateResponse(
        long reportId,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt) {}
