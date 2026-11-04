package com.dartinsight.planinterest.domain;

import com.dartinsight.common.error.ApiException;
import java.util.Arrays;

/** 요금제(FS-73). 결제는 없고 '관심 있어요' 수요만 센다. */
public enum Plan {
    FREE,
    PRO,
    TEAM,
    EMBED;

    /** 네 값 중 하나가 아니면(문자열이 아님 포함) 400 errors[plan] */
    public static Plan of(Object raw) {
        return Arrays.stream(values())
                .filter(plan -> plan.name().equals(raw))
                .findFirst()
                .orElseThrow(() -> ApiException.invalidInput("plan", "FREE, PRO, TEAM, EMBED 중 하나여야 합니다."));
    }
}
