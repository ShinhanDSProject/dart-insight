package com.dartinsight.checkpoint.domain;

/** 체크 포인트 한 항목의 상태(docs/api-spec.md). 좋고 나쁨이 아니라 규칙에 맞았는지다. */
public enum CheckpointStatus {
    /** 기준값에 걸림 */
    CHECK("확인해 볼 점"),
    /** 기준값에 걸리지 않음 */
    OK("특이사항 없음"),
    /** 규칙에 필요한 값을 찾지 못했거나 계산할 수 없음(0과 구분) */
    NO_DATA("자료 없음");

    private final String label;

    CheckpointStatus(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
