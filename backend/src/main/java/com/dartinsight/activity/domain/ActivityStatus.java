package com.dartinsight.activity.domain;

/** 두 보고서 사이 활동의 상태(docs/api-spec.md GET /api/analyses/{analysisId}/activities). */
public enum ActivityStatus {
    GENERATED,
    /** 고를 활동이 없음. AI가 0개로 답했으면 저장하고, 후보가 없어 부르지 않았으면 저장하지 않는다 */
    EMPTY,
    /** 다시 만들어도 검사를 통과한 카드가 없음. 저장한다 */
    REVIEW_NEEDED,
    /** 만들 자료가 없음. 저장하지 않는다 */
    NOT_AVAILABLE;

    /** AI 서버가 돌려준 상태. 모르는 값이면 null */
    public static ActivityStatus parse(String value) {
        if (value == null) {
            return null;
        }
        for (ActivityStatus status : values()) {
            if (status != NOT_AVAILABLE && status.name().equals(value)) {
                return status;
            }
        }
        return null;
    }
}
