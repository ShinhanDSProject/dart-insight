package com.dartinsight.community.repository;

import com.dartinsight.community.domain.ReportReason;

/** 신고 건 하나의 사유별 신고 수 */
public interface ReasonCount {
    Long getReportId();

    ReportReason getReason();

    long getCount();
}
