package com.dartinsight.financial.domain;

import java.util.Optional;

/** 재무제표 기준. OpenDART fs_div 값과 같다. */
public enum FsDiv {
    /** 연결재무제표 */
    CFS,
    /** 별도(개별)재무제표 */
    OFS;

    /** OpenDART 응답의 fs_div 값(앞뒤 공백 무시). 없거나 모르는 값이면 빈 값 */
    public static Optional<FsDiv> fromOpenDart(String value) {
        if (value == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(valueOf(value.trim()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
