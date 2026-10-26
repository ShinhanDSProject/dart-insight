package com.dartinsight.keyfact.domain;

/**
 * 두 보고서 사이에 바뀐 항목 하나. 값은 양쪽 원문을 그대로 옮기고 차이를 계산하지 않는다.
 *
 * @param name      최대주주·임원은 성명, 배당은 구분(se)
 * @param stockKind 주식 종류. 임원은 null
 * @param field     비교한 필드 이름(행 record의 컴포넌트 이름)
 * @param before    이전 보고서 값. ADDED면 null
 * @param after     현재 보고서 값. REMOVED면 null
 */
public record KeyFactChange(Type type, String name, String stockKind, String field, String before, String after) {

    public enum Type {
        /** 현재 보고서에만 있음 */
        ADDED,
        /** 이전 보고서에만 있음 */
        REMOVED,
        /** 값이 다름 */
        CHANGED
    }
}
