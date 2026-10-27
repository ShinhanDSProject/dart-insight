package com.dartinsight.outlook.domain;

/**
 * 전망·계획 항목의 종류(ADR-0039). 값은 ai-server app/outlook/model.py와 같다. 화면은 이 순서로 묶는다.
 */
public enum OutlookCategory {
    INVESTMENT("투자·설비"),
    NEW_BUSINESS("신규 사업·제품"),
    MARKET("시장·업황 전망"),
    FINANCIAL("재무·주주 정책"),
    OTHER("기타");

    private final String label;

    OutlookCategory(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** AI 서버가 보낸 값. 모르는 값이면 null */
    public static OutlookCategory parse(String value) {
        for (OutlookCategory category : values()) {
            if (category.name().equals(value)) {
                return category;
            }
        }
        return null;
    }
}
