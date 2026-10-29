package com.dartinsight.community.domain;

import com.dartinsight.common.error.ApiException;
import java.util.Arrays;

/** 신고 사유(community_report_entry.reason, API 명세 6.6 신고). */
public enum ReportReason {
    /** 특정인 모욕·명예훼손 */
    DEFAMATION,
    /** 허위 풍문 */
    FALSE_RUMOR,
    /** 유료 리딩방·상담 유인 */
    PAID_LEADING,
    /** 개인정보 노출 */
    PERSONAL_INFO;

    /** 요청 값. 문자열이 아니거나 네 값이 아니면 400(reason) */
    public static ReportReason of(Object raw) {
        return Arrays.stream(values())
                .filter(reason -> reason.name().equals(raw))
                .findFirst()
                .orElseThrow(() -> ApiException.invalidInput("reason",
                        "DEFAMATION, FALSE_RUMOR, PAID_LEADING, PERSONAL_INFO 중 하나여야 합니다."));
    }
}
