package com.dartinsight.community.domain;

/**
 * 관리자 신고 목록에서 처리할 이유. 저장하지 않고 읽을 때 정한다(docs/erd.md 커뮤니티).
 * 기한이 지나도 자동으로 풀지 않고 EXPIRED로 다시 올린다.
 */
public enum ReportTodo {
    /** 처리 대기 중인 새 신고 */
    PENDING,
    /** 지금 블라인드에 작성자가 재게시를 청구함. 기한도 지났으면 이쪽(작성자가 기다리는 쪽) */
    REPOST_REQUESTED,
    /** 블라인드 기한이 지났지만 아직 다시 처리하지 않음(가린 채 둠) */
    EXPIRED
}
