package com.dartinsight.analysis;

import java.util.Map;
import java.util.Set;

/**
 * 분석 작업 상태. PENDING → RUNNING → COMPLETED 또는 FAILED로만 바뀐다(허용 전이표).
 * 결과를 저장하기 전에는 COMPLETED가 되지 않는다.
 */
public enum AnalysisStatus {
    PENDING, RUNNING, COMPLETED, FAILED;

    private static final Map<AnalysisStatus, Set<AnalysisStatus>> ALLOWED = Map.of(
            PENDING, Set.of(RUNNING, FAILED),
            RUNNING, Set.of(COMPLETED, FAILED),
            COMPLETED, Set.of(),
            FAILED, Set.of());

    public boolean canMoveTo(AnalysisStatus next) {
        return ALLOWED.get(this).contains(next);
    }

    public boolean finished() {
        return this == COMPLETED || this == FAILED;
    }
}
