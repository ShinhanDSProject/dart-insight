package com.dartinsight.community.dto;

import com.dartinsight.community.domain.CommunityRepostRequest;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/** 마지막 블라인드에 대한 재게시 청구(관리자 신고 목록의 repostRequest) */
public record RepostResponse(
        String message,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime createdAt) {

    /** 청구가 없으면 null */
    public static RepostResponse of(CommunityRepostRequest request) {
        return request == null ? null : new RepostResponse(request.getMessage(), request.getCreatedAt());
    }
}
