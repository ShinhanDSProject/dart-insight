package com.dartinsight.textevent.domain;

import java.util.Map;
import java.util.Set;

/** 주요 사건 실행 상태. 허용 전이표 밖의 전이는 거부한다(EN-2). */
public enum TextEventRunStatus {
    PENDING, RUNNING, COMPLETED, FAILED, NOT_CREATED;

    private static final Map<TextEventRunStatus, Set<TextEventRunStatus>> ALLOWED = Map.of(
            PENDING, Set.of(RUNNING, FAILED),
            RUNNING, Set.of(COMPLETED, FAILED, NOT_CREATED),
            COMPLETED, Set.of(),
            FAILED, Set.of(),
            NOT_CREATED, Set.of());

    public boolean canMoveTo(TextEventRunStatus next) {
        return ALLOWED.get(this).contains(next);
    }

    public boolean finished() {
        return ALLOWED.get(this).isEmpty();
    }
}
