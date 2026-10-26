package com.dartinsight.favorite.domain;

/** 즐겨찾기 기업에서 새 정기보고서를 찾았다(6.3, ADR-0027). 후속 기능은 이 이벤트의 리스너로 붙인다. */
public record FavoriteReportFound(String corpCode, String rceptNo) {
}
