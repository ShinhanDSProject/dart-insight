package com.dartinsight.community.repository;

import com.dartinsight.community.domain.TargetType;

/** 신고 건의 대상(바뀌지 않는 칼럼만). 처리할 때 글 → 댓글 → 신고 건 순으로 잠그려고 먼저 읽는다 */
public interface ReportTargetRef {
    TargetType getTargetType();

    Long getTargetId();

    Long getPostId();
}
