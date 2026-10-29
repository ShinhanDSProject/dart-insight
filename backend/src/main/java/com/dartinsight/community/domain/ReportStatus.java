package com.dartinsight.community.domain;

/** 신고 건 상태(community_report.status). 관리자가 처리할 때만 바뀌고, 유지 뒤 새 신고가 오면 다시 OPEN이다. */
public enum ReportStatus {
    /** 처리 대기 */
    OPEN,
    /** 유지 */
    KEPT,
    /** 블라인드 */
    BLINDED,
    /** 삭제. 다시 처리하지 않는다 */
    DELETED
}
