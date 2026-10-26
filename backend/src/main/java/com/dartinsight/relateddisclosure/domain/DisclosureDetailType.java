package com.dartinsight.relateddisclosure.domain;

/**
 * 관련 수시공시로 받는 공시상세유형(OpenDART 공시검색 pblntf_detail_ty, ADR-0030).
 * 공시검색은 상세유형을 하나씩만 받으므로 유형마다 한 번씩 부른다.
 */
public enum DisclosureDetailType {
    /** 주요사항보고서 */
    B001,
    /** 수시공시(거래소) */
    I001,
    /** 공정공시 */
    I002
}
