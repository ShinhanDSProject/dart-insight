package com.dartinsight.analysis.domain;

/**
 * 분석이 완료됐다(결과 저장과 같은 트랜잭션에서 발행). 받는 쪽은 커밋 뒤에(@TransactionalEventListener AFTER_COMMIT) 써야
 * 저장되지 않은 결과에 반응하지 않는다(ADR-0031).
 */
public record AnalysisCompleted(long analysisId) {
}
