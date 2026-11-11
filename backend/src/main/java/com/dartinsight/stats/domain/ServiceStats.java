package com.dartinsight.stats.domain;

import java.time.Duration;
import java.time.LocalDateTime;

/** 첫 화면 숫자 줄에 보일 행 수와 센 시각(#866) */
public record ServiceStats(long listedCompanies, long completedAnalyses, long textChanges,
        LocalDateTime countedAt) {

    /** now가 센 시각부터 ttl 안이면 다시 세지 않아도 된다 */
    public boolean freshAt(LocalDateTime now, Duration ttl) {
        return now.isBefore(countedAt.plus(ttl));
    }
}
