package com.dartinsight.document;

/**
 * 원문 구조화 결과(4.2).
 * <ul>
 *   <li>STRUCTURED: 끝까지 읽음</li>
 *   <li>PARTIAL: 읽었지만 빠졌을 수 있는 곳이 있음(셀·문단 수가 원문과 다름 등). 경고에 사유</li>
 *   <li>FAILED: 읽지 못함(지원하지 않는 형식 등). 실패 사유가 있음</li>
 *   <li>NOT_AVAILABLE: OpenDART에 원문 파일이 없음(013·014)</li>
 * </ul>
 */
public enum DocumentStatus {
    STRUCTURED, PARTIAL, FAILED, NOT_AVAILABLE;

    /** 문단·표를 쓸 수 있는지 */
    public boolean usable() {
        return this == STRUCTURED || this == PARTIAL;
    }
}
