package com.dartinsight.textevent.domain;

/**
 * 사건을 만들지 않은 사유. 앞의 셋은 저장하지 않고 조회할 때 정하고, 뒤의 둘은 실행 행에 저장한다.
 * FAKE_MODEL은 다음 시작 때 새 실행을 만들고, NO_CANDIDATES는 같은 버전이면 그대로다.
 */
public enum NotCreatedReason {
    DISABLED, OLD_ANALYSIS, TEXT_COMPARE_FAILED, FAKE_MODEL, NO_CANDIDATES
}
